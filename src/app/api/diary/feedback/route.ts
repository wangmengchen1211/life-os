import { NextRequest, NextResponse } from 'next/server';
import { streamChatWithFallback } from '@/lib/ai/gateway';
import { DIARY_FEEDBACK_SYSTEM_PROMPT, buildDiaryFeedbackUserPrompt } from '@/lib/ai/prompts/diary-feedback';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { content, moodTags } = await req.json();

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: '日记内容不能为空' }, { status: 400 });
  }

  const userPrompt = buildDiaryFeedbackUserPrompt(content, moodTags);
  // 双通道容灾（DeepSeek 主力 + 千问兜底）+ SSE 心跳防断连
  const stream = streamChatWithFallback(DIARY_FEEDBACK_SYSTEM_PROMPT, userPrompt);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
