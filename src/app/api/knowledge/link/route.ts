import { NextRequest, NextResponse } from 'next/server';
import { chatJSONWithFallback } from '@/lib/ai/gateway';
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
  // 双通道容灾 + 强制 JSON 输出（快速模型，秒级返回）
  const { ok, text } = await chatJSONWithFallback(
    KNOWLEDGE_LINKING_SYSTEM_PROMPT,
    userPrompt,
  );

  if (!ok || !text.trim()) {
    return NextResponse.json({ error: 'AI服务异常' }, { status: 502 });
  }

  // 非流式 JSON 响应：原始文本由客户端容错解析（extractJSON）
  return NextResponse.json({ ok: true, result: text });
}
