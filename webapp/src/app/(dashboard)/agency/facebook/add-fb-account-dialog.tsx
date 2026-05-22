'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Facebook, AlertCircle, Settings2, Link2, Copy, CheckCircle2, Globe, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AddFacebookAccountDialog({
  reconnectAccountId,
  children
}: {
  reconnectAccountId?: string,
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const handleConnect = () => {
    setError(null)
    startTransition(async () => {
      const query = reconnectAccountId ? `?reconnectAccountId=${encodeURIComponent(reconnectAccountId)}` : ''
      window.location.href = `/api/v1/agency/facebook/oauth/start${query}`
    })
  }

  const handleGenerateMagicLink = async () => {
    setError(null)
    try {
      const res = await fetch('/api/v1/agency/facebook/oauth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconnectAccountId }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload?.error || 'Failed to generate magic link. Please try again.')
        return
      }
      setMagicLink(payload.url)
    } catch {
      setError('Failed to generate magic link. Please try again.')
    }
  }

  const copyToClipboard = () => {
    if (!magicLink) return
    navigator.clipboard.writeText(magicLink)
    setCopied(true)
    toast.success('Magic Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) {
        setMagicLink(null)
        setError(null)
      }
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="shadow-sm">
            <Facebook className="mr-2 h-4 w-4 text-primary" />
            Connect Facebook Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] w-full max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate">
            {reconnectAccountId ? 'Reconnect Account' : 'Connect Facebook Account'}
          </DialogTitle>
          <DialogDescription className="break-words">
            Authorize FBupload Pro using your agency&apos;s configured App credentials.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full mt-4 min-w-0 flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="direct">Direct Connect</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="py-6 flex flex-col items-center justify-center space-y-4 min-w-0 overflow-y-auto">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {reconnectAccountId ? <RefreshCw className="h-8 w-8 text-primary" /> : <Facebook className="h-8 w-8 text-primary" />}
            </div>

            {error ? (
              <div className="text-center space-y-3 w-full px-2">
                <div className="flex items-center justify-center text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4 mr-1.5 shrink-0" />
                  Configuration Required
                </div>
                <p className="text-xs text-muted-foreground break-words">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false)
                    router.push('/agency/settings')
                  }}
                >
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Go to Settings
                </Button>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground px-4 break-words">
                Recommended if you are logged into Facebook in <strong>this</strong> browser.
              </p>
            )}

            {!error && (
              <Button
                onClick={handleConnect}
                loading={isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4 shrink-0"
              >
                {reconnectAccountId ? 'Reconnect in This Browser' : 'Continue in This Browser'}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="magic" className="py-6 space-y-4 w-full overflow-hidden flex flex-col min-w-0">
            <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-sm space-y-2 shrink-0">
              <p className="font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                Cross-Browser Connection
              </p>
              <p className="text-muted-foreground leading-relaxed break-words">
                Use this link to reconnect Facebook accounts logged in on <strong>other browsers or devices</strong> without needing to log in to this website there.
              </p>
            </div>

            {!magicLink ? (
              <Button
                variant="outline"
                className="w-full h-12 dashed border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0"
                onClick={handleGenerateMagicLink}
              >
                <Link2 className="mr-2 h-4 w-4 shrink-0" />
                Generate Secure Reconnection Link
              </Button>
            ) : (
              <div className="agency-motion-standard w-full overflow-hidden flex flex-col min-w-0 space-y-4">
                <div className="space-y-2 min-w-0">
                  <div className="p-3 bg-muted rounded-lg border border-border w-full overflow-x-auto custom-scrollbar">
                    <p className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {magicLink}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full h-10 font-bold shrink-0"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4 shrink-0" />
                        Copy Magic Link
                      </>
                    )}
                  </Button>
                </div>
                <p className="shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Link expires in 10 minutes
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
