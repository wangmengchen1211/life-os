import { NextRequest, NextResponse } from 'next/server';
import { chatJSONWithFallback, chatVisionJSON } from '@/lib/ai/gateway';
import {
  KNOWLEDGE_TAGGING_SYSTEM_PROMPT,
  buildKnowledgeTaggingUserPrompt,
} from '@/lib/ai/prompts/knowledge-tagging';

// Next.js App Router: increase body size limit for base64 images
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { content, title, imageBase64, existingTags, categories } = await req.json();

  if (!content && !imageBase64) {
    return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'placeholder') {
    return NextResponse.json({ error: 'AI服务未配置' }, { status: 503 });
  }

  if (imageBase64 && imageBase64.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '图片过大（>10MB）' }, { status: 413 });
  }

  // 向后兼容：未提供时使用空数组
  const safeExistingTags: string[] = existingTags || [];
  const safeCategories: string[] = categories || [];

  try {
    let result: { ok: boolean; text: string };

    if (imageBase64) {
      // 图片：千问 VL 视觉模型直接理解图片内容并打标
      const userPrompt = buildKnowledgeTaggingUserPrompt({
        content: content || '请分析这张图片的内容',
        title,
        existingTags: safeExistingTags,
        categories: safeCategories,
      });
      result = await chatVisionJSON(KNOWLEDGE_TAGGING_SYSTEM_PROMPT, [
        { type: 'text', text: userPrompt },
        { type: 'image', imageUrl: imageBase64 },
      ]);
    } else {
      // 文本：双通道容灾 + 强制 JSON 输出（快速模型，秒级返回）
      const userPrompt = buildKnowledgeTaggingUserPrompt({
        content,
        title,
        existingTags: safeExistingTags,
        categories: safeCategories,
      });
      result = await chatJSONWithFallback(KNOWLEDGE_TAGGING_SYSTEM_PROMPT, userPrompt);
    }

    if (!result.ok || !result.text.trim()) {
      return NextResponse.json({ error: 'AI服务异常' }, { status: 502 });
    }

    // 非流式 JSON 响应：原始文本由客户端容错解析（extractJSON）
    return NextResponse.json({ ok: true, result: result.text });
  } catch (error) {
    console.error('[AI Tag] error:', error);
    return NextResponse.json({ error: 'AI服务异常' }, { status: 500 });
  }
}
