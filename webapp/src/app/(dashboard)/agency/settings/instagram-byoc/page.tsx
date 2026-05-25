import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Instagram } from 'lucide-react'

export default function InstagramByocShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Settings', href: '/agency/settings' },
        { label: 'Instagram BYOC' },
      ]}
      icon={<Instagram className="h-7 w-7 text-primary" />}
      title="Instagram BYOC"
      description="Bring your own Instagram Graph API application credentials."
      platformLabel="Instagram BYOC"
      cardDescription="temporarily unavailable for general public for now"
    />
  )
}
