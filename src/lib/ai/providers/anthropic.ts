import OpenAI from 'openai';

let _client: OpenAI | null = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'placeholder') {
      throw new Error('ANTHROPIC_API_KEY 未配置，请在 .env.local 中设置');
    }
    _client = new OpenAI({
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey,
      timeout: 60_000,
    });
  }
  return _client;
}

export async function streamChat(
  systemPrompt: string,
  userContent: string | Array<any>
): Promise<ReadableStream> {
  let client: OpenAI;
  try {
    client = getClient();
  } catch (error) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : 'AI配置错误' })}\n\n`));
        controller.close();
      },
    });
  }

  // 将 Anthropic 风格的多模态内容转换为 OpenAI 格式
  let messages: OpenAI.ChatCompletionMessageParam[];
  if (typeof userContent === 'string') {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];
  } else {
    // 多模态（图片+文本）
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: userContent.map((item: any) => {
          if (item.type === 'image') {
            return { type: 'image_url' as const, image_url: { url: item.source?.data || '' } };
          }
          return { type: 'text' as const, text: item.text || '' };
        }),
      },
    ];
  }

  const stream = await client.chat.completions.create({
    model: 'qwen3.7-max',
    max_tokens: 2048,
    stream: true,
    temperature: 0.7,
    messages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
            );
          }
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', content: fullText })}\n\n`)
        );
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', content: error.message || 'Unknown error' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
}
