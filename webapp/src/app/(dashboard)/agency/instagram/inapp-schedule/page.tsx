import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Instagram } from 'lucide-react'

export default function InstagramInappScheduleShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Instagram' },
        { label: 'InApp Schedule' },
      ]}
      icon={<Instagram className="h-7 w-7 text-primary" />}
      title="Instagram InApp Schedule"
      description="Queue and publish Instagram content on a schedule."
      platformLabel="Instagram InApp Schedule"
    />
  )
}
