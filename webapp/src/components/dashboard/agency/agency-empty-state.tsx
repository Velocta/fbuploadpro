import type { ReactNode } from 'react'

import { CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AgencySectionCard } from './agency-section-card'

export function AgencyEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
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
      </CardContent>
    </AgencySectionCard>
  )
}
