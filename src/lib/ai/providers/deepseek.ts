import OpenAI from 'openai';

let _client: OpenAI | null = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
      timeout: 60_000, // 60s 超时
    });
  }
  return _client;
}

export async function streamChatDeepSeek(
  systemPrompt: string,
  userContent: string
): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  
  const stream = await getClient().chat.completions.create({
    model: 'qwen3.7-max',
    max_tokens: 2048,
    stream: true,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

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
