import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Youtube } from 'lucide-react'

export default function YoutubeDirectScheduleShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'YouTube' },
        { label: 'Direct Schedule' },
      ]}
      icon={<Youtube className="h-7 w-7 text-primary" />}
      title="YouTube Direct Schedule"
      description="Schedule YouTube uploads in advance."
      platformLabel="YouTube Direct Schedule"
    />
  )
}
