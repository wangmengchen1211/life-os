import { NextRequest, NextResponse } from 'next/server';
import { streamChatDeepSeek } from '@/lib/ai/providers/deepseek';
import { MIRROR_SYSTEM_PROMPT } from '@/lib/ai/prompts/mirror-insight';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, imageBase64, history, userProfile } = await req.json();

    if (!message && !imageBase64) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    // 构建 system prompt（注入用户画像）
    const systemPrompt = MIRROR_SYSTEM_PROMPT.replace(
      '{userProfile}',
      userProfile || '暂无用户画像数据'
    );

    // 构建对话上下文
    let userContent = '';
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10); // 最近5轮（10条消息）
      userContent += '以下是我们之前的对话：\n';
      for (const msg of recentHistory) {
        userContent += `${msg.role === 'user' ? '用户' : '你'}：${msg.content}\n`;
      }
      userContent += '\n---\n\n';
    }
    userContent += `用户当前消息：${message || '请看图片'}`;

    // 选择模型并调用
    let stream: ReadableStream;

    if (imageBase64) {
      // 含图片：动态加载 OCR 模块（避免原生绑定在 Windows 上崩溃）
      let ocrText = '';
      try {
        const { extractTextFromImage } = await import('@/lib/ai/ocr');
        ocrText = await extractTextFromImage(imageBase64);
      } catch (e) {
        console.warn('[mirror] OCR unavailable, proceeding without image text:', (e as Error).message);
      }
      const combinedContent = ocrText
        ? `${userContent}\n\n[图片文字]\n${ocrText}`
        : userContent;
      stream = await streamChatDeepSeek(systemPrompt, combinedContent);
    } else {
      // 纯文本：使用 DeepSeek
      stream = await streamChatDeepSeek(systemPrompt, userContent);
    }

    // 返回 SSE 流
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'AI 服务调用失败' },
      { status: 500 }
    );
  }
}
