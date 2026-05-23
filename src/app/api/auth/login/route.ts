import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import { SessionData, sessionOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const passwordHash = process.env.ACCESS_PASSWORD_HASH!;
  const isValid = await bcrypt.compare(password, passwordHash);

  if (!isValid) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.isLoggedIn = true;
  await session.save();

  return response;
}
