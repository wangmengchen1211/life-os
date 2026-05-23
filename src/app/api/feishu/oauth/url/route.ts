import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/feishu/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const url = buildAuthUrl(state);
    return NextResponse.json({ url, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
