'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function FBCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const errorParam = searchParams.get('error')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const callbackStatus: 'loading' | 'success' | 'error' =
    statusParam === 'success' ? 'success' : statusParam === 'error' || !!searchParams.get('error') ? 'error' : 'loading'
  const callbackError = errorParam || searchParams.get('error_description') || 'Facebook authentication was cancelled.'

  useEffect(() => {
    if (code && !statusParam) {
      const qs = new URLSearchParams({ code })
      if (state) qs.set('state', state)
      window.location.href = `/api/v1/agency/facebook/oauth/callback?${qs.toString()}`
      return
    }

    if (callbackStatus === 'success') {
      const timer = setTimeout(() => {
        router.push('/agency/facebook/accounts')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [callbackStatus, code, state, statusParam, router])

  return (
    <Card className="agency-surface-card w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Facebook Connection</CardTitle>
        <CardDescription>
          {callbackStatus === 'loading' && 'Completing the connection...'}
          {callbackStatus === 'success' && 'Account connected successfully! Redirecting...'}
          {callbackStatus === 'error' && 'Something went wrong.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8">
        {callbackStatus === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        {callbackStatus === 'success' && <CheckCircle2 className="h-10 w-10 text-primary" />}
        {callbackStatus === 'error' && (
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-destructive text-sm">{callbackError}</p>
            <Button variant="outline" onClick={() => router.push('/agency/facebook/accounts')}>
              Go back to Facebook accounts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function FBCallbackPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Suspense fallback={
        <Card className="agency-surface-card w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Facebook Connection</CardTitle>
            <CardDescription>Loading connection details...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      }>
        <FBCallbackContent />
      </Suspense>
    </div>
  )
}
