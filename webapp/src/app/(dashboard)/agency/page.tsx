import { Suspense } from 'react'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AddTokensDialog } from './add-tokens-dialog'
import { DashboardOverviewContent } from './overview-content'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { AlertTriangle, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default async function AgencyDashboard() {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()

  // Fetch only necessary profile data for the header and token state
  const { data: profile } = await supabase
    .from('users')
    .select('name, tokens_balance')
    .eq('id', user.id)
    .single()
  const hasTokens = (profile?.tokens_balance ?? 0) > 0

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Overview' }
        ]}
      />

      <AgencyPageHeader
        title={`Welcome, ${profile?.name ?? 'Agency'}`}
        description="Monitor your automation health and profile usage."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/v1/agency/usage/export.csv" download>
                <FileDown className="mr-2 h-4 w-4 text-muted-foreground" />
                Download usage CSV
              </a>
            </Button>
            <AddTokensDialog />
          </>
        }
      />

      {!hasTokens ? (
        <section className="rounded-2xl border border-border bg-muted/30 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                Token balance is 0
              </p>
              <p className="text-sm font-medium text-foreground">
                Add tokens to unlock Facebook, YouTube, and Instagram features in the sidebar.
              </p>
            </div>
            <AddTokensDialog />
          </div>
        </section>
      ) : null}

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverviewContent userId={user.id} />
      </Suspense>
    </div>
  )
}
