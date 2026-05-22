import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

export function AuthErrorAlert({
  message,
}: {
  message: string | null | undefined
}) {
  if (!message) return null

  return (
    <Alert variant="destructive" className="border-destructive/40">
      <AlertCircle className="size-4 shrink-0 text-destructive" />
      <AlertDescription className="text-destructive [&_p]:text-destructive">
        {message}
      </AlertDescription>
    </Alert>
  )
}
