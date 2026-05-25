import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Instagram } from 'lucide-react'

export default function InstagramDirectScheduleShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Instagram' },
        { label: 'Direct Schedule' },
      ]}
      icon={<Instagram className="h-7 w-7 text-primary" />}
      title="Instagram Direct Schedule"
      description="Schedule Instagram posts in advance."
      platformLabel="Instagram Direct Schedule"
    />
  )
}
