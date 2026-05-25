import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Instagram } from 'lucide-react'

export default function InstagramDirectPostShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Instagram' },
        { label: 'Direct Post' },
      ]}
      icon={<Instagram className="h-7 w-7 text-primary" />}
      title="Instagram Direct Post"
      description="Publish to Instagram immediately."
      platformLabel="Instagram Direct Post"
    />
  )
}
