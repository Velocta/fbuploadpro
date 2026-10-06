import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Youtube } from 'lucide-react'

export default function YoutubeByocShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Settings', href: '/agency/settings' },
        { label: 'YouTube BYOC' },
      ]}
      icon={<Youtube className="h-7 w-7 text-primary" />}
      title="YouTube BYOC"
      description="Bring your own YouTube API application credentials."
      platformLabel="YouTube BYOC"
      cardDescription="temporarily unavailable for general public for now"
    />
  )
}
