import type { ReactNode } from 'react'
import { Construction } from 'lucide-react'

import { AgencyGlassPageHero, type AgencyBreadcrumbSegment } from './agency-glass-page-hero'
import { AgencySectionCard } from './agency-section-card'
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card'

export function AgencyComingSoon({
  segments,
  title,
  description,
  platformLabel,
  icon,
  cardDescription,
}: {
  segments: AgencyBreadcrumbSegment[]
  title: string
  description: string
  platformLabel: string
  icon?: ReactNode
  cardDescription?: ReactNode
}) {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={segments}
        title={title}
        description={description}
        icon={icon}
      />
      <AgencySectionCard className="border-dashed py-12">
        <CardContent className="flex flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <Construction className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-semibold">{platformLabel} is coming soon</CardTitle>
          <CardDescription className="mt-2 max-w-md">
            {cardDescription || 'This feature is not available yet. Facebook tools are ready in the sidebar when you have tokens.'}
          </CardDescription>
        </CardContent>
      </AgencySectionCard>
    </div>
  )
}
