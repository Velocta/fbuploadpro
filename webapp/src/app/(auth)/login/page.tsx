'use client'

import { useTransition, useState } from 'react'
import { login } from './actions'
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
import Link from 'next/link'
import {
  AuthBackLink,
  AuthErrorAlert,
  AuthFormCard,
  authInlineLinkClass,
} from '@/components/auth'

import { useBrand } from '@/components/brand-provider'

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const brand = useBrand()

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.unconfirmed) {
        window.location.href = `/signup?step=otp&email=${encodeURIComponent(result.email)}`
        return
      }
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="w-full space-y-6">
      {!brand.hideLanding && (
        <AuthBackLink href="/">Back to Homepage</AuthBackLink>
      )}

      <AuthFormCard>
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Sign in
          </CardTitle>
          <CardDescription>
            Enter your email and password to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                {!brand.hideForgotPassword && (
                  <Link href="/login/forgot-password" className={authInlineLinkClass}>
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                maxLength={100}
              />
            </div>
            <AuthErrorAlert message={error} />
            <Button className="w-full" type="submit" loading={isPending}>
              Sign in
            </Button>
          </form>
        </CardContent>
        {!brand.hideSignup && (
          <CardFooter className="flex w-full flex-col items-stretch border-t border-border/60 pt-6">
            <p className="w-full text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className={authInlineLinkClass}>
                Sign up as agency
              </Link>
            </p>
          </CardFooter>
        )}
      </AuthFormCard>
    </div>
  )
}

