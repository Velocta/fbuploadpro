import Link from 'next/link'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { Facebook, Instagram, Settings, Youtube } from 'lucide-react'

export default function AgencySettingsLandingPage() {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Settings' },
        ]}
        icon={<Settings className="h-7 w-7 text-primary" />}
        title="Settings"
        description="Platform configuration and bring-your-own-app credentials."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Button asChild variant="outline" className="h-auto flex-col gap-2 py-6">
          <Link href="/agency/settings/facebook-byoc">
            <Facebook className="h-5 w-5 text-primary" />
            Facebook BYOC
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-2 py-6">
          <Link href="/agency/settings/youtube-byoc">
            <Youtube className="h-5 w-5 text-primary" />
            YouTube BYOC
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-2 py-6">
          <Link href="/agency/settings/instagram-byoc">
            <Instagram className="h-5 w-5 text-primary" />
            Instagram BYOC
          </Link>
        </Button>
      </div>
    </div>
  )
}
