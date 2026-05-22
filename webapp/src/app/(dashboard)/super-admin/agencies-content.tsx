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
  const [{ data: agencies }, { data: pages }] = await Promise.all([
    supabase
      .from('users')
      .select('id,name,email,phone_number,tokens_balance,is_active_override')
      .eq('role', 'agency'),
    supabase.from('pages').select('agency_id,status'),
  ])

  const pageCountsByAgency = new Map<string, { total_pages: number; active_pages: number }>()
  for (const page of pages || []) {
    const current = pageCountsByAgency.get(page.agency_id) || {
      total_pages: 0,
      active_pages: 0,
    }

    current.total_pages += 1
    if (page.status === 'active') {
      current.active_pages += 1
    }

    pageCountsByAgency.set(page.agency_id, current)
  }

  const agenciesWithPageCounts = (agencies || []).map((agency) => {
    const counts = pageCountsByAgency.get(agency.id)
    return {
      ...agency,
      total_pages: counts?.total_pages ?? 0,
      active_pages: counts?.active_pages ?? 0,
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
