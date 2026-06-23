import Link from 'next/link'
import { Settings2, Youtube } from 'lucide-react'
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
          <div className="pt-1">
            <a
              href="https://youtu.be/xdNZ_cjJUbI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive hover:text-destructive/90 bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20 transition-all hover:bg-destructive/15"
            >
              <Youtube className="h-4 w-4" />
              Watch Video Setup Guide
            </a>
          </div>
          {fbAccountsCount === 0 ? (
            <p className="text-xs text-muted-foreground pt-1">No Facebook accounts linked yet.</p>
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
