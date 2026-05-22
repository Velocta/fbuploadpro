'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('User Dashboard Error:', error)
    }, [error])

    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-card/50 p-8 backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-lg shadow-destructive/20">
                <AlertCircle className="h-10 w-10" />
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-display font-black tracking-tighter text-foreground">SYSTEM CRITICAL ERROR</h2>
                <p className="mt-2 text-muted-foreground font-medium">
                    An unexpected protocol failure occurred while processing dashboard resources.
                    {error.message.includes('RLS') ? ' Access denied by security protocols.' : ''}
                </p>
            </div>
            <Button
                onClick={() => reset()}
                className="h-12 px-6 font-bold shadow-xl shadow-primary/20"
            >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Restart Dashboard
            </Button>
        </div>
    )
}
