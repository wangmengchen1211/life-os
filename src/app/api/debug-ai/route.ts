import { NextResponse } from 'next/server';

// 临时调试端点：检查 AI 网关环境变量是否正确注入
// 部署后访问 /api/debug-ai 验证，验证后删除
export async function GET() {
  const config = {
    DEEPSEEK_API_KEY_set: !!process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_API_KEY_length: process.env.DEEPSEEK_API_KEY?.length ?? 0,
    DEEPSEEK_API_KEY_prefix: process.env.DEEPSEEK_API_KEY?.slice(0, 6) ?? 'MISSING',
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || 'DEFAULT(api.deepseek.com)',
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY_length: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    ANTHROPIC_API_KEY_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 6) ?? 'MISSING',
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'DEFAULT(dashscope)',
    AI_TEXT_MODEL_PRIMARY: process.env.AI_TEXT_MODEL_PRIMARY || 'DEFAULT(deepseek-chat)',
    AI_TEXT_MODEL_FALLBACK: process.env.AI_TEXT_MODEL_FALLBACK || 'DEFAULT(qwen3.7-max)',
  };

  return NextResponse.json(config);
}
