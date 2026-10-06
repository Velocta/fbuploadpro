'use client'

import { useTransition, useState, Suspense } from 'react'
import { verifyOtp } from '../forgot-password/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSearchParams } from 'next/navigation'
import { AuthBackLink, AuthErrorAlert, AuthFormCard } from '@/components/auth'

function VerifyOtpForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') || ''

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await verifyOtp(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="w-full space-y-6">
      <AuthBackLink href="/login">Back to login</AuthBackLink>

      <AuthFormCard>
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Verify code
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to{' '}
            {emailParam ? <strong>{emailParam}</strong> : 'your email'}.
          </CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-4">
            <input type="hidden" name="email" value={emailParam} />
            <div className="space-y-2">
              <Label htmlFor="otp">One-time code</Label>
              <Input
                id="otp"
                name="otp"
                placeholder="123456"
                required
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-center font-mono text-xl tracking-[0.35em] sm:text-2xl"
              />
            </div>
            <AuthErrorAlert message={error} />
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-6">
            <Button className="w-full" type="submit" loading={isPending}>
              Verify and continue
            </Button>
          </CardFooter>
        </form>
      </AuthFormCard>
    </div>
  )
}

function VerifyOtpFallback() {
  return (
    <div className="w-full space-y-6">
      <AuthBackLink href="/login">Back to login</AuthBackLink>
      <AuthFormCard>
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Verify code
          </CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </CardContent>
      </AuthFormCard>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<VerifyOtpFallback />}>
      <VerifyOtpForm />
    </Suspense>
  )
}
