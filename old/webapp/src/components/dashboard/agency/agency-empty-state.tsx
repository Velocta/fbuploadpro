import type { ReactNode } from 'react'
import Link from 'next/link'

import { HubLinkPendingOverlay } from '@/components/dashboard/hub-link-pending-overlay'
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AgencySectionCard } from './agency-section-card'

export function AgencyEmptyState({
  icon,
  title,
  description,
  action,
  actionHref,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  actionHref?: { label: string; href: string }
}) {
  return (
    <AgencySectionCard className="border-dashed py-10">
      <CardContent className="flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-muted/40 text-primary">
          {icon}
        </div>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="mt-2 max-w-md">{description}</CardDescription>
        {action ? (
          <Button variant="link" className="mt-2 h-9" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
        {actionHref ? (
          <Button variant="link" className="relative mt-2 h-9" asChild>
            <Link href={actionHref.href} className="relative inline-flex items-center">
              {actionHref.label}
              <HubLinkPendingOverlay className="rounded-md" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </AgencySectionCard>
  )
}
