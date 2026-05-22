import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { buildUsageCsvForUser } from '@/server/services/agency/usage-export'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency', 'super_admin'])
  if (auth.error) return auth.error

  try {
    const csvContent = await buildUsageCsvForUser(auth.user.id)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="token-usage-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
