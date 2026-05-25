import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Instagram } from 'lucide-react'

export default function InstagramAccountsShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Instagram' },
        { label: 'Accounts' },
      ]}
      icon={<Instagram className="h-7 w-7 text-primary" />}
      title="Instagram Accounts"
      description="Connect Instagram accounts for publishing and scheduling."
      platformLabel="Instagram Accounts"
    />
  )
}
