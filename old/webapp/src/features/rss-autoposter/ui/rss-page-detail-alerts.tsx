'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RssPageDetailAlerts({
  accountInvalid,
  lastFetchError,
}: {
  accountInvalid: boolean
  lastFetchError: string | null
}) {
  if (!accountInvalid && !lastFetchError) return null

  const title = accountInvalid ? 'Facebook token invalid' : 'Last fetch error'
  const description = accountInvalid
    ? 'Reconnect your Facebook account to resume RSS auto-posting for this page.'
    : lastFetchError

  return (
    <Alert
      variant="destructive"
      className={cn(
        'rounded-2xl border border-destructive/20 bg-destructive/10 shadow-lg backdrop-blur-xl',
      )}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-bold text-destructive">{title}</AlertTitle>
      <AlertDescription className="text-destructive/90">
        <p>{description}</p>
        {accountInvalid ? (
          <Button variant="link" className="mt-2 h-auto p-0 text-destructive" asChild>
            <Link href="/agency/facebook/accounts">Reconnect account</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
