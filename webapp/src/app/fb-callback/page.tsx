'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

function FBCallbackContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const statusParam = searchParams.get('status')
        const errorParam = searchParams.get('error')
        const code = searchParams.get('code')
        const state = searchParams.get('state')

        async function processCallback() {
            if (!statusParam) {
                if (code) {
                    const qs = new URLSearchParams({ code })
                    if (state) qs.set('state', state)
                    window.location.href = `/api/v1/public/facebook/oauth/callback?${qs.toString()}`
                    return
                }
                setStatus('error')
                setError('Missing callback status from API flow.')
                return
            }

            if (statusParam === 'success') {
                setStatus('success')
            } else {
                setStatus('error')
                setError(errorParam || 'An unexpected error occurred while connecting your account.')
            }
        }

        processCallback()
    }, [searchParams, router])

    if (status === 'loading') {
        return (
            <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center pb-8">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tighter">Verifying Connection</CardTitle>
                    <CardDescription>
                        Finishing the secure connection with Facebook...
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (status === 'success') {
        return (
            <Card className="w-full max-w-md border-primary/10 bg-primary/5 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center pb-8">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                        <CheckCircle2 className="h-10 w-10 text-green-500 animate-in zoom-in duration-300" />
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tighter text-green-600">Successfully Connected!</CardTitle>
                    <CardDescription className="text-base">
                        Your Facebook account is now linked to your agency.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-8">
                    <p className="text-sm text-muted-foreground">
                        You can now securely close this browser tab and return to your main dashboard to manage your pages.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/5 backdrop-blur-xl shadow-2xl">
            <CardHeader className="text-center pb-8">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tighter text-destructive">Connection Failed</CardTitle>
                <CardDescription className="text-destructive/80">
                    {error || 'Something went wrong during the connection process.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex justify-center">
                <button
                    onClick={() => router.push('/agency/facebook/accounts')}
                    className="text-sm font-bold text-primary hover:underline"
                >
                    Back to Dashboard
                </button>
            </CardContent>
        </Card>
    )
}

export default function FBCallbackPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background p-6">
            <Suspense fallback={null}>
                <FBCallbackContent />
            </Suspense>
        </div>
    )
}
