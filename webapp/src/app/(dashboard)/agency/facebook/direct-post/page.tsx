import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Send } from 'lucide-react'
import { DirectPostClient } from './direct-post-client'

export default function FacebookDirectPostPage() {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        icon={<Send className="h-6 w-6 text-primary" />}
        title="Direct Post"
        description="Publish text, image, or video to a Facebook Page immediately."
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'Direct Post' },
        ]}
      />
      <DirectPostClient />
    </div>
  )
}
