'use client'

import { useTransition, useState } from 'react'
import { requestReset } from './actions'
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
import { AuthBackLink, AuthErrorAlert, AuthFormCard } from '@/components/auth'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await requestReset(formData)
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
            Forgot password
          </CardTitle>
          <CardDescription>
            Enter your Gmail address and we&apos;ll email you a one-time code to
            reset your password.
          </CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-4">
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
            <AuthErrorAlert message={error} />
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-6">
            <Button className="w-full" type="submit" loading={isPending}>
              Send one-time code
            </Button>
          </CardFooter>
        </form>
      </AuthFormCard>
    </div>
  )
}
