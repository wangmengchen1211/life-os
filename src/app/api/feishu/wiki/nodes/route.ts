import { NextRequest, NextResponse } from 'next/server';
import { listWikiNodes } from '@/lib/feishu/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    userAccessToken?: string;
    spaceId?: string;
    parentNodeToken?: string;
    pageToken?: string;
    pageSize?: number;
  };
  if (!body.userAccessToken || !body.spaceId) {
    return NextResponse.json(
      { error: 'missing userAccessToken or spaceId' },
      { status: 400 }
    );
  }
  try {
    const resp = await listWikiNodes({
      userAccessToken: body.userAccessToken,
      spaceId: body.spaceId,
      parentNodeToken: body.parentNodeToken,
      pageToken: body.pageToken,
      pageSize: body.pageSize,
    });
    if (resp.code !== 0 || !resp.data) {
      return NextResponse.json({ error: resp.msg || 'wiki_nodes_failed', code: resp.code }, { status: 400 });
    }
    return NextResponse.json(resp.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
