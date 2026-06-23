'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleInappPageStatusAction } from '../actions'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { AgencyInlineStatus } from '@/components/dashboard/agency'

export function InappPageToggle({ pageId, initialStatus }: { pageId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => {
      setStatus(initialStatus)
    }, 0)
    return () => clearTimeout(t)
  }, [initialStatus])

  const handleToggle = () => {
    if (isPending) return

    const previousStatus = status
    const nextStatus = status === 'active' ? 'inactive' : 'active'
    setStatus(nextStatus)

    startTransition(async () => {
      const result = await toggleInappPageStatusAction(pageId, previousStatus)
      if (result?.error || !result?.success) {
        setStatus(previousStatus)
        toast.error('Failed to update status', {
          description: result?.error || 'Unknown error occurred',
        })
      } else {
        toast.success(`InApp Scheduling ${nextStatus === 'active' ? 'activated' : 'paused'}`, {
          description: `Page scheduling is now ${nextStatus === 'active' ? 'active' : 'inactive'}.`,
        })
        router.refresh()
      }
    })
  }

  const isActive = status === 'active'
  const toggleLocked = status === 'fb_rate_limited'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-col">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduling</Label>
        <div className="flex items-center gap-2">
          <AgencyInlineStatus label={isActive ? 'Active' : 'Paused'} tone={isActive ? 'default' : 'muted'} />
          {isPending && <RefreshCcw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isPending || toggleLocked}
      />
    </div>
  )
}
