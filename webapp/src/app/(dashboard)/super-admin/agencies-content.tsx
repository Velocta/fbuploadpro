import { createClient, getSessionUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AgenciesView } from './agencies-view'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export async function SuperAdminAgenciesContent() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const [{ data: agencies }, { data: stats }] = await Promise.all([
    supabase
      .from('users')
      .select('id,name,email,phone_number,tokens_balance,is_active_override')
      .eq('role', 'agency'),
    supabase.from('agency_page_stats' as any).select('*') as any,
  ])

  interface AgencyStats {
    agency_id: string
    adu_total_pages: number
    adu_active_pages: number
    inapp_total_pages: number
    inapp_active_pages: number
  }

  const statsMap = new Map<string, AgencyStats>()
  for (const s of (stats as unknown as AgencyStats[]) || []) {
    statsMap.set(s.agency_id, s)
  }

  const agenciesWithPageCounts = (agencies || []).map((agency) => {
    const s = statsMap.get(agency.id)
    return {
      ...agency,
      adu_total_pages: s?.adu_total_pages ?? 0,
      adu_active_pages: s?.adu_active_pages ?? 0,
      inapp_total_pages: s?.inapp_total_pages ?? 0,
      inapp_active_pages: s?.inapp_active_pages ?? 0,
      combined_total_pages: (s?.adu_total_pages ?? 0) + (s?.inapp_total_pages ?? 0),
      combined_active_pages: (s?.adu_active_pages ?? 0) + (s?.inapp_active_pages ?? 0),
    }
  })

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Super Admin', href: '/super-admin' },
          { label: 'Agencies' },
        ]}
      />

      <AgencyPageHeader
        title="Agencies"
        description="Manage all registered agencies and their token balances."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/super-admin">Overview</Link>
            </Button>
            <Button asChild>
              <Link href="/super-admin/agencies">Agencies</Link>
            </Button>
          </div>
        }
      />

      <AgenciesView agencies={agenciesWithPageCounts} />
    </div>
  )
}
