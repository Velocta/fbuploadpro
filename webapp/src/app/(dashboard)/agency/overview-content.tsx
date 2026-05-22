import { createClient } from '@/lib/supabase/server'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { AgencySectionCard, AgencyInlineStatus } from '@/components/dashboard/agency'

export async function DashboardOverviewContent({ userId }: { userId: string }) {
  const supabase = await createClient()

  // Fetch Agency & Pages Stats
  const pagesData = await supabase
    .from('pages')
    .select('id, status', { count: 'exact' })
    .eq('agency_id', userId)

  const totalPages = pagesData.count || 0
  const activePages = pagesData.data?.filter((p) => p.status === 'active').length || 0

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      <AgencySectionCard className="text-left">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary/90">
            Connected pages
          </CardTitle>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-baseline space-x-2">
            <div className="font-display text-4xl font-semibold text-foreground">{totalPages}</div>
            <div className="text-sm text-muted-foreground">Social pages connected</div>
          </div>
          <p className="text-sm text-muted-foreground">
            You can connect unlimited pages.
          </p>
        </CardContent>
      </AgencySectionCard>

      <AgencySectionCard>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary/90">
            Automation health
          </CardTitle>
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="font-display text-4xl font-semibold text-foreground">{activePages}</div>
          <p className="text-sm text-muted-foreground">Pages currently active and posting</p>
          <AgencyInlineStatus label="System protocol online" />
        </CardContent>
      </AgencySectionCard>
    </div>
  )
}
