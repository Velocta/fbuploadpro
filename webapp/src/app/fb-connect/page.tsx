'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Facebook, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

function FBConnectContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = async () => {
        if (!token) return
        setError(null)
        setIsPending(true)
        try {
            window.location.href = `/api/v1/public/facebook/oauth/start?token=${encodeURIComponent(token)}`
        } catch {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsPending(false)
        }
    }

    if (!token) {
        return (
            <Card className="w-full max-w-md border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <div className="flex items-center space-x-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle>Invalid Magic Link</CardTitle>
                    </div>
                    <CardDescription>
                        This link is missing a required security token. Please generate a new link from your dashboard.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="text-center pb-8">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                    <Facebook className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-3xl font-display font-black tracking-tighter">Facebook Identity</CardTitle>
                <CardDescription className="text-base mt-2">
                    Connect an additional Facebook identity to your agency account securely.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-3">
                    <div className="flex items-center space-x-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Security Protocol</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        This session is encrypted and linked to your main agency profile. You do not need to log in to the website in this browser.
                    </p>
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        <p className="text-xs text-destructive font-medium leading-relaxed">{error}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="pt-4">
                <Button
                    className="w-full h-14 text-lg font-black tracking-tight"
                    onClick={handleConnect}
                    disabled={isPending}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Establishing Connection...
                        </>
                    ) : (
                        "Connect This Account"
                    )}
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function FBConnectPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background p-6">
            <Suspense fallback={
                <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl animate-pulse">
                    <div className="h-[400px]" />
                </Card>
            }>
                <FBConnectContent />
            </Suspense>
        </div>
    )
}
