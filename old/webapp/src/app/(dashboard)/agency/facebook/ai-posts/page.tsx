import { AgencyComingSoon } from '@/components/dashboard/agency'
import { Wand2 } from 'lucide-react'

export default function AiPostsFacebookShell() {
  return (
    <AgencyComingSoon
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Facebook', href: '/agency/facebook' },
        { label: 'AI Text/Image Posts' },
      ]}
      icon={<Wand2 className="h-7 w-7 text-primary" />}
      title="AI Text/Image Posts"
      description="Create posts using AI for Facebook"
      platformLabel="AI Text/Image Posts"
      cardDescription="temporarily unavailable for general public for now"
    />
  )
}
