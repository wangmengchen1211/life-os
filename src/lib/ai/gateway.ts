import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════
// AI 双通道容灾网关
// - 主通道 DeepSeek，失败/超时/空内容自动切换千问（DashScope）兜底
// - 流式响应内置 keep-alive 心跳，防止代理/Vercel 空闲掐断
// - 推理模型的 reasoning_content 仅做前端展示，不计入最终输出
// ═══════════════════════════════════════════════════════════════════════════

const FIRST_TOKEN_TIMEOUT_MS = 20_000; // 建流（首 token）超时 → 触发切换
const REQUEST_TIMEOUT_MS = 30_000; // 单通道请求超时
const HEARTBEAT_INTERVAL_MS = 10_000; // SSE 心跳间隔

const TEXT_MODEL_PRIMARY = process.env.AI_TEXT_MODEL_PRIMARY || 'deepseek-chat';
const TEXT_MODEL_FALLBACK = process.env.AI_TEXT_MODEL_FALLBACK || 'qwen3.7-max';
const JSON_MODEL_PRIMARY = process.env.AI_JSON_MODEL_PRIMARY || 'deepseek-chat';
const JSON_MODEL_FALLBACK = process.env.AI_JSON_MODEL_FALLBACK || 'qwen-turbo';
const VISION_MODEL = process.env.AI_VISION_MODEL || 'qwen-vl-max';

let _deepseek: OpenAI | null = null;
let _qwen: OpenAI | null = null;

function getDeepSeek(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return _deepseek;
}

function getQwen(): OpenAI {
  if (!_qwen) {
    _qwen = new OpenAI({
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder',
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return _qwen;
}

type ChatStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

/** 带首 token 超时的建流；超时或建流失败抛错，由调用方切换通道 */
async function openStream(
  channel: 'deepseek' | 'qwen',
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<ChatStream> {
  const client = channel === 'deepseek' ? getDeepSeek() : getQwen();
  const createPromise = client.chat.completions.create({
    model,
    max_tokens: 2048,
    stream: true,
    temperature: 0.7,
    messages,
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`[ai-gateway] ${channel} 建流超时 ${FIRST_TOKEN_TIMEOUT_MS}ms`)),
      FIRST_TOKEN_TIMEOUT_MS,
    ),
  );
  return Promise.race([createPromise, timeoutPromise]);
}

const encoder = new TextEncoder();
const sseFrame = (obj: Record<string, unknown>) =>
  encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
const HEARTBEAT_FRAME = encoder.encode(': keep-alive\n\n');

/**
 * 流式对话：DeepSeek 主力，失败/超时自动切千问兜底；内置 SSE 心跳。
 * 输出 SSE 帧：{ type: 'text' | 'done' | 'error', content }
 */
export function streamChatWithFallback(
  systemPrompt: string,
  userContent: string,
): ReadableStream {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
  return buildFallbackStream(messages);
}

/** 视觉模型多模态内容块 */
export interface VisionPart {
  type: 'text' | 'image';
  text?: string;
  /** data URL 或 http(s) 图片地址 */
  imageUrl?: string;
}

/**
 * 图片理解：直接走千问 VL 视觉模型（DeepSeek 无视觉能力）。
 */
export function streamVisionChat(
  systemPrompt: string,
  parts: VisionPart[],
): ReadableStream {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = parts.map((p) =>
    p.type === 'image'
      ? { type: 'image_url', image_url: { url: p.imageUrl || '' } }
      : { type: 'text', text: p.text || '' },
  );
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
  return buildFallbackStream(messages, { vision: true });
}

function buildFallbackStream(
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: { vision?: boolean } = {},
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(HEARTBEAT_FRAME);
        } catch {
          /* 流已关闭 */
        }
      }, HEARTBEAT_INTERVAL_MS);

      let fullText = '';
      let hasContent = false; // 是否有实际 content（区别于 reasoning_content）

      /** 从流中读取内容，返回是否有实际 content */
      async function readStream(stream: ChatStream): Promise<boolean> {
        let gotContent = false;
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta as
            | { content?: string; reasoning_content?: string }
            | undefined;
          const content = delta?.content || '';
          const reasoning = delta?.reasoning_content || '';
          if (content) {
            fullText += content;
            hasContent = true;
            gotContent = true;
            controller.enqueue(sseFrame({ type: 'text', content }));
          } else if (reasoning) {
            // 推理模型：前端展示推理过程，但不计入最终输出
            controller.enqueue(sseFrame({ type: 'text', content: reasoning }));
          }
        }
        return gotContent;
      }

      try {
        if (opts.vision) {
          // 视觉仅千问通道支持，直接兜底通道建流
          const stream = await openStream('qwen', VISION_MODEL, messages);
          await readStream(stream);
        } else {
          // 1. 主通道 DeepSeek
          let primaryOk = false;
          try {
            const stream = await openStream('deepseek', TEXT_MODEL_PRIMARY, messages);
            primaryOk = await readStream(stream);
          } catch (primaryErr) {
            console.warn(
              '[ai-gateway] DeepSeek 通道失败，切换千问兜底:',
              primaryErr instanceof Error ? primaryErr.message : primaryErr,
            );
          }

          // 2. 主通道无实际 content（推理模型耗尽 token / 返回空）→ 千问兜底
          if (!primaryOk) {
            if (!hasContent) {
              console.warn('[ai-gateway] DeepSeek 未返回实际内容，切换千问兜底');
            }
            const stream = await openStream('qwen', TEXT_MODEL_FALLBACK, messages);
            await readStream(stream);
          }
        }

        if (fullText.trim().length === 0) {
          controller.enqueue(sseFrame({ type: 'error', content: 'AI 未返回有效内容，请重试' }));
        } else {
          controller.enqueue(sseFrame({ type: 'done', content: fullText }));
        }
      } catch (err) {
        console.error('[ai-gateway] 双通道均失败:', err);
        controller.enqueue(sseFrame({ type: 'error', content: 'AI 服务暂时不可用，请稍后重试' }));
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
}

/**
 * 视觉模型非流式调用（图片打标等结构化场景）：
 * 提示词要求输出 JSON，解析容错交给调用方（extractJSON）。
 */
export async function chatVisionJSON(
  systemPrompt: string,
  parts: VisionPart[],
): Promise<{ ok: boolean; text: string }> {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = parts.map((p) =>
    p.type === 'image'
      ? { type: 'image_url', image_url: { url: p.imageUrl || '' } }
      : { type: 'text', text: p.text || '' },
  );

  for (const attempt of [true, false]) {
    try {
      const res = await getQwen().chat.completions.create({
        model: VISION_MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        // 部分 VL 模型不支持 response_format，失败后降级为普通输出再重试
        ...(attempt ? { response_format: { type: 'json_object' as const } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
      });
      const text = res.choices[0]?.message?.content || '';
      if (text.trim().length > 0) return { ok: true, text };
    } catch (err) {
      console.warn(
        `[ai-gateway] Vision JSON 调用失败（response_format=${attempt}）:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { ok: false, text: '' };
}

/**
 * 非流式 JSON 对话（打标/关联等结构化场景）：
 * 快速模型 + response_format=json_object，失败自动切兜底通道。
 * 返回原始文本由调用方解析（解析失败可重试）。
 */
export async function chatJSONWithFallback(
  systemPrompt: string,
  userContent: string,
): Promise<{ ok: boolean; text: string; channel: string }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const channels: Array<{ name: string; model: string; make: () => OpenAI }> = [
    { name: 'deepseek', model: JSON_MODEL_PRIMARY, make: getDeepSeek },
    { name: 'qwen', model: JSON_MODEL_FALLBACK, make: getQwen },
  ];

  for (const ch of channels) {
    try {
      const res = await ch.make().chat.completions.create({
        model: ch.model,
        max_tokens: 2048,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages,
      });
      const text = res.choices[0]?.message?.content || '';
      if (text.trim().length > 0) {
        return { ok: true, text, channel: ch.name };
      }
    } catch (err) {
      console.warn(
        `[ai-gateway] JSON 通道 ${ch.name} 失败:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { ok: false, text: '', channel: 'none' };
}
