'use client'

import { useTransition, useState, Suspense, useEffect } from 'react'
import { signUp, verifyOtpAction, resendOtpAction } from './actions'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getMainDomain, isVercelPreviewHost } from '@/lib/config/runtime'
import {
  AuthBackLink,
  AuthErrorAlert,
  AuthFormCard,
  authInlineLinkClass,
} from '@/components/auth'

const COUNTRY_OPTIONS = [
  { code: '+92', label: 'Pakistan' },
  { code: '+1', label: 'United States' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+971', label: 'United Arab Emirates' },
  { code: '+91', label: 'India' },
  { code: '+966', label: 'Saudi Arabia' },
  { code: '+974', label: 'Qatar' },
  { code: '+968', label: 'Oman' },
  { code: '+965', label: 'Kuwait' },
  { code: '+973', label: 'Bahrain' },
]

function SignupContent() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const [step, setStep] = useState<'signup' | 'otp'>(
    (searchParams.get('step') as 'signup' | 'otp') || 'signup',
  )
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [countryCode, setCountryCode] = useState('+92')
  const [localPhoneNumber, setLocalPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [targetSubdomain, setTargetSubdomain] = useState<string | null>(null)

  useEffect(() => {
    if (isVerified) {
      const timer = setTimeout(() => {
        const mainDomain = getMainDomain()
        const protocol = window.location.protocol
        const hostname = window.location.hostname
        const isPreviewHost = isVercelPreviewHost(hostname)

        if (hostname.includes('localhost') || isPreviewHost || !targetSubdomain) {
          window.location.href = '/agency'
        } else {
          const cleanMainDomain = mainDomain.replace(/^https?:\/\//, '').split(':')[0]
          window.location.href = `${protocol}//${targetSubdomain}.${cleanMainDomain}/agency`
        }
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [isVerified, targetSubdomain])

  const handleSignup = (formData: FormData) => {
    setError(null)
    const typedEmail = formData.get('email') as string
    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result?.success) {
        setEmail(result.email || typedEmail)
        setStep('otp')
        toast.success(result.message)
      }
    })
  }

  const handleResendOtp = () => {
    if (!email) return
    startTransition(async () => {
      const result = await resendOtpAction(email)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
      }
    })
  }

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code from your email.')
      return
    }

    startTransition(async () => {
      const result = await verifyOtpAction(email, otp)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result?.success) {
        setIsVerified(true)
        setTargetSubdomain(result.subdomain || null)
        toast.success('Account verified. Redirecting to your dashboard…')
      }
    })
  }

  return (
    <div className="w-full space-y-6">
      <AuthBackLink href="/">Back to Homepage</AuthBackLink>

      <AuthFormCard className="relative overflow-hidden">
        {step === 'signup' ? (
          <>
            <CardHeader className="space-y-2">
              <CardTitle className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Create an account
              </CardTitle>
              <CardDescription>
                Registrations use Gmail only (@gmail.com).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Gmail address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="yourname@gmail.com"
                    required
                    disabled={isPending}
                  />
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                    Only @gmail.com addresses are accepted.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone number</Label>
                  <input
                    type="hidden"
                    name="phone_number"
                    value={`${countryCode}${localPhoneNumber}`}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={countryCode}
                      onValueChange={setCountryCode}
                      disabled={isPending}
                    >
                      <SelectTrigger className="col-span-1">
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.label} ({country.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone_number"
                      type="tel"
                      placeholder="3001234567"
                      required
                      value={localPhoneNumber}
                      onChange={(e) => setLocalPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={isPending}
                      className="col-span-2"
                    />
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                    Required WhatsApp number you will be requesting tokens from.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={isPending}
                  />
                </div>
                <AuthErrorAlert message={error} />
                <Button className="w-full" type="submit" loading={isPending}>
                  Send code to Gmail
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                <ShieldCheck className="size-7 shrink-0 text-primary" aria-hidden />
                Verify email
              </CardTitle>
              <CardDescription>
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below
                to finish signup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-muted-foreground">
                    Verification code
                  </Label>
                  <Input
                    id="otp"
                    name="otp"
                    placeholder="000000"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="h-14 text-center font-mono text-2xl tracking-[0.35em] sm:text-3xl"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    disabled={isPending}
                  />
                </div>
                <AuthErrorAlert message={error} />
                <Button className="w-full" type="submit" loading={isPending}>
                  Verify and create account
                </Button>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full"
                    onClick={handleResendOtp}
                    disabled={isPending}
                  >
                    Resend code
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    className="w-full"
                    onClick={() => setStep('signup')}
                    disabled={isPending}
                  >
                    Change email
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}

        {isVerified && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/85 px-6 py-8 text-center backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-10 shrink-0 text-primary animate-spin motion-reduce:animate-none" />
            <div className="space-y-1">
              <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                Preparing your dashboard
              </p>
              <p className="text-sm text-muted-foreground motion-reduce:animate-none animate-pulse">
                Assigning your workspace…
              </p>
            </div>
          </div>
        )}

        <CardFooter className="flex w-full flex-col items-stretch gap-4 border-t border-border/60 pt-6">
          <p className="text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className={authInlineLinkClass}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className={authInlineLinkClass}>
              Privacy Policy
            </Link>
            .
          </p>
          <Separator />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className={authInlineLinkClass}>
              Sign in
            </Link>
          </p>
        </CardFooter>
      </AuthFormCard>
    </div>
  )
}

function SignupFallback() {
  return (
    <div className="w-full space-y-6">
      <AuthBackLink href="/">Back to Homepage</AuthBackLink>
      <AuthFormCard>
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Create an account
          </CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </CardContent>
      </AuthFormCard>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  )
}
