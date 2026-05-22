import Link from 'next/link'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { ComingSoon } from '@/components/dashboard/coming-soon'
import { Button } from '@/components/ui/button'

export default function AgencySettingsLandingPage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs segments={[{ label: 'Agency', href: '/agency' }, { label: 'Settings' }]} />
      <AgencyPageHeader title="Settings" description="Platform configuration and bring-your-own-app credentials." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Button asChild variant="outline" className="h-auto py-6">
          <Link href="/agency/settings/facebook-byoc">Facebook BYOC</Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-6">
          <Link href="/agency/settings/youtube-byoc">YouTube BYOC</Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-6">
          <Link href="/agency/settings/instagram-byoc">Instagram BYOC</Link>
        </Button>
      </div>
      <ComingSoon title="More settings" description="Additional platform settings will appear here." />
    </div>
  )
}
