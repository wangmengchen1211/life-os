import { NextRequest, NextResponse } from 'next/server';
import { streamChatDeepSeek } from '@/lib/ai/providers/deepseek';
import { DIARY_FEEDBACK_SYSTEM_PROMPT, buildDiaryFeedbackUserPrompt } from '@/lib/ai/prompts/diary-feedback';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { content, moodTags } = await req.json();

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: '日记内容不能为空' }, { status: 400 });
  }

  const userPrompt = buildDiaryFeedbackUserPrompt(content, moodTags);
  const stream = await streamChatDeepSeek(DIARY_FEEDBACK_SYSTEM_PROMPT, userPrompt);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
