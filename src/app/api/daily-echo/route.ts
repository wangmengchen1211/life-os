import { NextRequest, NextResponse } from 'next/server';
import { streamChatWithFallback } from '@/lib/ai/gateway';
import {
  DAILY_ECHO_SYSTEM_PROMPT,
  buildDailyEchoUserPrompt,
} from '@/lib/ai/prompts/daily-echo';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST body: { diaries: string[] }
// 返回非流式 JSON：{ echo: string }
// 说明：今日回响只需要一句话且要做一天级缓存，前端用 non-stream 更简单。
export async function POST(req: NextRequest) {
  const { diaries } = (await req.json()) as { diaries?: string[] };

  if (!diaries || !Array.isArray(diaries) || diaries.length === 0) {
    return NextResponse.json({ error: '今日没有日记内容' }, { status: 400 });
  }

  const userPrompt = buildDailyEchoUserPrompt(diaries);
  // 双通道容灾（DeepSeek 主力 + 千问兜底）+ SSE 心跳防断连
  const stream = streamChatWithFallback(DAILY_ECHO_SYSTEM_PROMPT, userPrompt);

  // 内部把 SSE stream 读完，聚合为最终一句话
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';
  let errorMsg: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE：以 \n\n 分 chunk，每个以 'data: ' 开头
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const p of parts) {
      const line = p.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      try {
        const obj = JSON.parse(payload) as { type: string; content?: string };
        if (obj.type === 'done' && typeof obj.content === 'string') {
          fullText = obj.content;
        } else if (obj.type === 'error') {
          errorMsg = obj.content ?? 'AI 错误';
        }
      } catch {
        // 忽略单条解析失败
      }
    }
  }

  if (errorMsg) {
    return NextResponse.json({ error: errorMsg }, { status: 502 });
  }

  const echo = fullText
    .trim()
    .replace(/^[「『"'"']+|[」』"'"']+$/g, '') // 去掉首尾引号
    .replace(/^今日回响[:：]\s*/i, ''); // 去掉可能的前缀

  if (!echo) {
    return NextResponse.json(
      { echo: '今天的文字是平静的——也许有些感触正在水面下酝酿' }
    );
  }

  return NextResponse.json({ echo });
}
