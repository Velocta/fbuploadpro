import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Youtube } from 'lucide-react'

export default function YoutubeAccountsShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'YouTube' },
        { label: 'Accounts' },
      ]}
      icon={<Youtube className="h-7 w-7 text-primary" />}
      title="YouTube Accounts"
      description="Connect YouTube channels for publishing and scheduling."
      platformLabel="YouTube Accounts"
    />
  )
}
