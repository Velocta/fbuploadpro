import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { readTokenPrice, writeTokenPrice } from '@/server/repositories/system-settings'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['super_admin', 'agency'])
  if (auth.error) return auth.error

  try {
    const tokenPrice = await readTokenPrice()
    return NextResponse.json({ tokenPrice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(['super_admin'])
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const tokenPrice = Number(body?.tokenPrice)
  if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) {
    return NextResponse.json({ error: 'Invalid tokenPrice' }, { status: 400 })
  }

  try {
    await writeTokenPrice(tokenPrice)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
