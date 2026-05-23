import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const consoleUrl = 'https://dashscope.console.aliyun.com/';

  try {
    // DashScope 兼容的余额查询
    const res = await fetch(`${baseUrl}/dashboard/billing/credit_grants`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ available: true, data, consoleUrl });
    }

    // 尝试 subscription 端点
    const res2 = await fetch(`${baseUrl}/dashboard/billing/subscription`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res2.ok) {
      const data = await res2.json();
      return NextResponse.json({ available: true, data, consoleUrl });
    }

    // API 不可用，返回控制台链接
    return NextResponse.json({
      available: false,
      consoleUrl,
    });
  } catch {
    return NextResponse.json({
      available: false,
      consoleUrl,
    });
  }
}
