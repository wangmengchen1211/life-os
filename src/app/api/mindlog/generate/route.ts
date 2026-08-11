import { NextRequest, NextResponse } from 'next/server';
import { streamChatDeepSeek } from '@/lib/ai/providers/deepseek';
import {
  buildDailyMindlogPrompt,
  buildWeeklyMindlogPrompt,
  buildMonthlyMindlogPrompt,
  type DailyMindlogData,
  type WeeklyMindlogData,
  type MonthlyMindlogData,
} from '@/lib/ai/prompts/mindlog';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface MindlogGenerateRequest {
  type: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  data: DailyMindlogData | WeeklyMindlogData | MonthlyMindlogData;
}

export async function POST(req: NextRequest) {
  const body: MindlogGenerateRequest = await req.json();
  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json({ error: '缺少 type 或 data 字段' }, { status: 400 });
  }

  // 根据 type 选择模型（语言任务统一使用 DeepSeek V4 Pro）
  const isDaily = type === 'daily';

  // 构建 prompt
  let prompt: { system: string; user: string };
  switch (type) {
    case 'daily':
      prompt = buildDailyMindlogPrompt(data as DailyMindlogData);
      break;
    case 'weekly':
      prompt = buildWeeklyMindlogPrompt(data as WeeklyMindlogData);
      break;
    case 'monthly':
      prompt = buildMonthlyMindlogPrompt(data as MonthlyMindlogData);
      break;
    default:
      return NextResponse.json({ error: '无效的 type，仅支持 daily/weekly/monthly' }, { status: 400 });
  }

  try {
    const stream = await streamChatDeepSeek(prompt.system, prompt.user);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    // 错误详情仅记录服务端日志，不外泄给前端
    console.error('[mindlog/generate] AI 服务调用失败:', error);
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
