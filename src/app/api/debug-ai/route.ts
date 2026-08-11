import { NextResponse } from 'next/server';

// 临时调试端点：检查 AI 网关环境变量 + 测试实际 API 调用
// 验证后删除
export async function GET() {
  const dsKey = process.env.DEEPSEEK_API_KEY || '';
  const dsBase = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').trim();

  const config = {
    DEEPSEEK_API_KEY_prefix: dsKey.slice(0, 6),
    DEEPSEEK_BASE_URL: dsBase,
    DEEPSEEK_BASE_URL_has_trailing_space: process.env.DEEPSEEK_BASE_URL !== dsBase,
    AI_TEXT_MODEL_PRIMARY: process.env.AI_TEXT_MODEL_PRIMARY || 'DEFAULT(deepseek-chat)',
    AI_TEXT_MODEL_FALLBACK: process.env.AI_TEXT_MODEL_FALLBACK || 'DEFAULT(qwen3.7-max)',
  };

  // 测试两个模型名
  const tests: Record<string, unknown> = {};

  for (const model of ['deepseek-chat', 'deepseek-v4-pro']) {
    try {
      const res = await fetch(`${dsBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dsKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '说一个字' }],
          max_tokens: 50,
          stream: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        tests[model] = { ok: false, status: res.status, error: errText.slice(0, 200) };
      } else {
        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        tests[model] = {
          ok: true,
          content: (msg?.content || '').slice(0, 100),
          reasoning_content: (msg?.reasoning_content || '').slice(0, 100),
          finish_reason: data.choices?.[0]?.finish_reason,
        };
      }
    } catch (err) {
      tests[model] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ config, tests });
}
