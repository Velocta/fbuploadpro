import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgencySectionCard } from '@/components/dashboard/agency'
import { CardContent } from '@/components/ui/card'

export function DashboardByocSetupCard({
  fbAccountsCount,
}: {
  fbAccountsCount: number
}) {
  return (
    <AgencySectionCard className="border-primary/20">
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Setup required</p>
          <p className="text-sm text-muted-foreground">
            Connect your Facebook app in Settings before linking accounts or running Facebook
            automation.
          </p>
          {fbAccountsCount === 0 ? (
            <p className="text-xs text-muted-foreground">No Facebook accounts linked yet.</p>
          ) : null}
        </div>
        <Button asChild className="shrink-0 rounded-xl">
          <Link href="/agency/settings/facebook-byoc">
            <Settings2 className="mr-2 h-4 w-4" />
            Connect app in Settings
          </Link>
        </Button>
      </CardContent>
    </AgencySectionCard>
  )
}
