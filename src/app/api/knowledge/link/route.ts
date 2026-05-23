import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '@/lib/ai/service';
import {
  KNOWLEDGE_LINKING_SYSTEM_PROMPT,
  buildKnowledgeLinkingUserPrompt,
} from '@/lib/ai/prompts/knowledge-linking';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { newItem, existingItems } = await req.json();

  if (!newItem || !existingItems || existingItems.length === 0) {
    return NextResponse.json({ links: [] });
  }

  const userPrompt = buildKnowledgeLinkingUserPrompt(newItem, existingItems);
  const stream = await streamChat(KNOWLEDGE_LINKING_SYSTEM_PROMPT, userPrompt);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
