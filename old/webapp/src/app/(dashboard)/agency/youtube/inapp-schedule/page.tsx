import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Youtube } from 'lucide-react'

export default function YoutubeInappScheduleShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'YouTube' },
        { label: 'InApp Schedule' },
      ]}
      icon={<Youtube className="h-7 w-7 text-primary" />}
      title="YouTube InApp Schedule"
      description="Queue and publish YouTube content on a schedule."
      platformLabel="YouTube InApp Schedule"
    />
  )
}
