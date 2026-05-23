import { NextRequest, NextResponse } from 'next/server';
import { getDocxRawContent } from '@/lib/feishu/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { userAccessToken?: string; docToken?: string };
  if (!body.userAccessToken || !body.docToken) {
    return NextResponse.json({ error: 'missing userAccessToken or docToken' }, { status: 400 });
  }
  try {
    const resp = await getDocxRawContent({
      userAccessToken: body.userAccessToken,
      docToken: body.docToken,
    });
    if (resp.code !== 0 || !resp.data) {
      return NextResponse.json({ error: resp.msg || 'content_failed', code: resp.code }, { status: 400 });
    }
    return NextResponse.json({ content: resp.data.content });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
