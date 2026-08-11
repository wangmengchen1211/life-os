import { NextRequest, NextResponse } from 'next/server';
import { streamChatWithFallback, streamVisionChat } from '@/lib/ai/gateway';
import { MIRROR_SYSTEM_PROMPT } from '@/lib/ai/prompts/mirror-insight';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, imageBase64, history, userProfile } = await req.json();

    if (!message && !imageBase64) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    // 构建 system prompt（注入用户画像）
    const systemPrompt = MIRROR_SYSTEM_PROMPT.replace(
      '{userProfile}',
      userProfile || '暂无用户画像数据'
    );

    // 构建对话上下文
    let userContent = '';
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10); // 最近5轮（10条消息）
      userContent += '以下是我们之前的对话：\n';
      for (const msg of recentHistory) {
        userContent += `${msg.role === 'user' ? '用户' : '你'}：${msg.content}\n`;
      }
      userContent += '\n---\n\n';
    }
    userContent += `用户当前消息：${message || '请看图片'}`;

    // 双通道容灾网关：含图片走千问 VL 视觉模型直接理解图片，纯文本走 DeepSeek/千问
    const stream = imageBase64
      ? streamVisionChat(systemPrompt, [
          { type: 'text', text: userContent },
          { type: 'image', imageUrl: imageBase64 },
        ])
      : streamChatWithFallback(systemPrompt, userContent);

    // 返回 SSE 流
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    // 错误详情仅记录服务端日志，不外泄给前端
    console.error('[mirror/chat] AI 服务调用失败:', error);
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
