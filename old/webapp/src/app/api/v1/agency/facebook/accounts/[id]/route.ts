import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { removeAgencyFacebookAccount } from '@/server/services/agency/facebook-accounts'

export const runtime = 'nodejs'

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const { id } = await context.params
  try {
    await removeAgencyFacebookAccount(auth.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
