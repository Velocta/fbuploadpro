import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { listAgencyFacebookAccountsEnriched } from '@/server/services/agency/facebook-accounts'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { accounts, summary } = await listAgencyFacebookAccountsEnriched(auth.user.id)
    return NextResponse.json({ accounts, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

