import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth';

export async function GET() {
  const session = await getServerSessionContext();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
  });
}
