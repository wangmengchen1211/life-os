import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
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

  // 根据 type 选择模型（统一使用 qwen3.7-max）
  const isDaily = type === 'daily';
  const model = 'qwen3.7-max';
  const apiKey = process.env.DEEPSEEK_API_KEY || '';

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

  // 创建 OpenAI 客户端
  const client = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        const completion = await client.chat.completions.create({
          model,
          max_tokens: 2048,
          stream: true,
          temperature: 0.7,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        });

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
            );
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', content: fullText })}\n\n`)
        );
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', content: error.message || 'Unknown error' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
