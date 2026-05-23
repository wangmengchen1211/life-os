import { NextRequest, NextResponse } from 'next/server';
import { refreshUserToken } from '@/lib/feishu/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { refreshToken?: string };
  if (!body.refreshToken) {
    return NextResponse.json({ error: 'missing refreshToken' }, { status: 400 });
  }
  try {
    const resp = await refreshUserToken(body.refreshToken);
    if (resp.code !== 0 || !resp.data) {
      return NextResponse.json({ error: resp.msg || 'refresh_failed', code: resp.code }, { status: 400 });
    }
    const now = Date.now();
    return NextResponse.json({
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token,
      accessExpiresAt: new Date(now + resp.data.expires_in * 1000).toISOString(),
      refreshExpiresAt: new Date(now + resp.data.refresh_token_expires_in * 1000).toISOString(),
      scope: resp.data.scope,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
