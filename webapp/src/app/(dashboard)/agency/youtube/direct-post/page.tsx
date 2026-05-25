import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Youtube } from 'lucide-react'

export default function YoutubeDirectPostShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'YouTube' },
        { label: 'Direct Post' },
      ]}
      icon={<Youtube className="h-7 w-7 text-primary" />}
      title="YouTube Direct Post"
      description="Publish to YouTube channels immediately."
      platformLabel="YouTube Direct Post"
    />
  )
}
