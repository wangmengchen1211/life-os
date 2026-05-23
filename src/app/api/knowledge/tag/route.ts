import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '@/lib/ai/service';
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

  let userContent: string;

  if (imageBase64) {
    // 图片：动态加载 OCR 模块（避免原生绑定在 Windows 上崩溃）
    let ocrText = '';
    try {
      const { extractTextFromImage } = await import('@/lib/ai/ocr');
      ocrText = await extractTextFromImage(imageBase64);
    } catch (e) {
      console.warn('[knowledge-tag] OCR unavailable:', (e as Error).message);
    }
    const combinedContent = ocrText
      ? (content ? `${content}\n\n[图片文字]\n${ocrText}` : ocrText)
      : (content || '请分析这张图片的内容');
    userContent = buildKnowledgeTaggingUserPrompt({
      content: combinedContent,
      title,
      existingTags: safeExistingTags,
      categories: safeCategories,
    });
  } else {
    userContent = buildKnowledgeTaggingUserPrompt({
      content,
      title,
      existingTags: safeExistingTags,
      categories: safeCategories,
    });
  }

  try {
    const stream = await streamChat(KNOWLEDGE_TAGGING_SYSTEM_PROMPT, userContent);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[AI Tag] streamChat error:', error);
    return NextResponse.json({ error: 'AI服务异常' }, { status: 500 });
  }
}
