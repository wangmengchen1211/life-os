import { NextRequest, NextResponse } from 'next/server';
import { listDriveFiles } from '@/lib/feishu/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    userAccessToken?: string;
    pageToken?: string;
    folderToken?: string;
    pageSize?: number;
  };
  if (!body.userAccessToken) {
    return NextResponse.json({ error: 'missing userAccessToken' }, { status: 400 });
  }
  try {
    const resp = await listDriveFiles({
      userAccessToken: body.userAccessToken,
      pageToken: body.pageToken,
      folderToken: body.folderToken,
      pageSize: body.pageSize,
    });
    if (resp.code !== 0 || !resp.data) {
      return NextResponse.json({ error: resp.msg || 'list_failed', code: resp.code }, { status: 400 });
    }
    return NextResponse.json(resp.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
