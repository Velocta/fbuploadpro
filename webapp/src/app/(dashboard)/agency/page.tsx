import { Suspense } from 'react'
import { AddTokensDialog } from './add-tokens-dialog'
import { AddTokensAutoOpen } from './add-tokens-auto-open'
import { DashboardOverviewContent } from './overview-content'
import { DashboardTokenBanner } from './dashboard-token-banner'
import { DashboardByocSetupCard } from './dashboard-byoc-setup-card'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { BarChart3, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import {
  deriveTokenBalanceTier,
  hasFacebookByocConfigured,
} from './dashboard-overview-utils'

export default async function AgencyDashboard() {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('name, tokens_balance, fb_app_id, fb_app_secret, rss_autoposter_enabled')
    .eq('id', user.id)
    .single()

  const tokensBalance = profile?.tokens_balance ?? 0
  const hasTokens = tokensBalance > 0
  const tokenTier = deriveTokenBalanceTier(tokensBalance)
  const hasFacebookApp = hasFacebookByocConfigured(profile)

  const { count: fbAccountsCount } = await supabase
    .from('facebook_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', user.id)

  return (
    <div className="space-y-6 agency-motion-standard pb-8">
      <Suspense fallback={null}>
        <AddTokensAutoOpen />
      </Suspense>

      <AgencyGlassPageHero
        segments={[{ label: 'Agency', href: '/agency' }, { label: 'Overview' }]}
        icon={<BarChart3 className="h-7 w-7 text-primary" />}
        title={`Welcome, ${profile?.name ?? 'Agency'}`}
        description="Monitor automation health and page status at a glance."
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

      {tokenTier === 'zero' || tokenTier === 'low' ? (
        <DashboardTokenBanner tier={tokenTier} tokensBalance={tokensBalance} />
      ) : null}

      {tokenTier !== 'zero' && !hasFacebookApp ? (
        <DashboardByocSetupCard fbAccountsCount={fbAccountsCount ?? 0} />
      ) : null}

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverviewContent
          userId={user.id}
          tokensBalance={tokensBalance}
          hasTokens={hasTokens}
          tokenTier={tokenTier}
          hasFacebookApp={hasFacebookApp}
          fbAccountsCount={fbAccountsCount ?? 0}
          rssAutoposterEnabled={profile?.rss_autoposter_enabled ?? false}
        />
      </Suspense>
    </div>
  )
}
