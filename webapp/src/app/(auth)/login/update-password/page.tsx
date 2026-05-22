'use client'

import { useTransition, useState } from 'react'
import { updatePassword } from '../forgot-password/actions'
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

export default function UpdatePasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (formData: FormData) => {
    setError(null)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const result = await updatePassword(formData)
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
            New password
          </CardTitle>
          <CardDescription>
            Choose a strong password for your account.
          </CardDescription>
        </CardHeader>
        <form action={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                required
              />
            </div>
            <AuthErrorAlert message={error} />
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-6">
            <Button className="w-full" type="submit" loading={isPending}>
              Update password
            </Button>
          </CardFooter>
        </form>
      </AuthFormCard>
    </div>
  )
}
