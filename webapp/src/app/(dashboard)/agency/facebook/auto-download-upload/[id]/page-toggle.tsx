'use client'

import { useTransition } from 'react'
import { togglePageStatus } from './actions'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { AgencyInlineStatus } from '@/components/dashboard/agency'

export function PageToggle({ pageId, initialStatus }: { pageId: string, initialStatus: string }) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newStatus = initialStatus === 'active' ? 'paused' : 'active'
    startTransition(async () => {
      const result = await togglePageStatus(pageId, initialStatus)
      if (result?.error) {
        toast.error('Failed to update status', {
          description: result.error,
        })
      } else {
        toast.success(`Automation ${newStatus}`, {
          description: `Page automation has been ${newStatus === 'active' ? 'activated' : 'paused'}.`,
        })
      }
    })
  }

  const isActive = initialStatus === 'active'

  return (
    <div className="agency-surface-card flex items-center space-x-3 rounded-lg p-3">
      <div className="flex flex-col">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation</Label>
        <div className="flex items-center gap-2">
          <AgencyInlineStatus label={isActive ? 'Active' : 'Paused'} tone={isActive ? 'default' : 'muted'} />
          {isPending && <RefreshCcw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
    </div>
  )
}
