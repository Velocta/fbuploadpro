'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Facebook,
  AlertCircle,
  Settings2,
  Link2,
  Copy,
  CheckCircle2,
  Globe,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Monitor,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type ConnectMode = 'direct' | 'magic'

const MODE_TABS = [
  {
    value: 'direct' as const,
    label: 'Direct Connect',
    icon: Monitor,
    description: 'Same browser',
  },
  {
    value: 'magic' as const,
    label: 'Magic Link',
    icon: Globe,
    description: 'Other device',
  },
]

export function AddFacebookAccountDialog({
  reconnectAccountId,
  reconnectAccountName,
  children,
}: {
  reconnectAccountId?: string
  reconnectAccountName?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ConnectMode>('direct')
  const [isPending, startTransition] = useTransition()
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const isReconnect = Boolean(reconnectAccountId)
  const isBusy = isPending || isGeneratingLink

  const handleConnect = () => {
    setError(null)
    startTransition(async () => {
      const query = reconnectAccountId ? `?reconnectAccountId=${encodeURIComponent(reconnectAccountId)}` : ''
      window.location.href = `/api/v1/agency/facebook/oauth/start${query}`
    })
  }

  const handleGenerateMagicLink = async () => {
    setError(null)
    setIsGeneratingLink(true)
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
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyToClipboard = () => {
    if (!magicLink) return
    navigator.clipboard.writeText(magicLink)
    setCopied(true)
    toast.success('Magic Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const resetOnClose = () => {
    setMagicLink(null)
    setError(null)
    setMode('direct')
    setIsGeneratingLink(false)
    setCopied(false)
  }

  const switchMode = (next: ConnectMode) => {
    if (isBusy) return
    setMode(next)
    setMagicLink(null)
    setError(null)
    setIsGeneratingLink(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val)
        if (!val) resetOnClose()
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button className="h-11 rounded-xl bg-primary px-5 text-primary-foreground shadow-sm hover:bg-primary/90">
            <Facebook className="mr-2 h-4 w-4" />
            Connect Facebook Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[540px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative group"
        >
          <motion.div
            className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/25 to-blue-500/25 opacity-60 blur-2xl"
            aria-hidden
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
          >
            <motion.div
              className="border-b border-border/50 bg-gradient-to-br from-card/80 via-card/60 to-primary/5 px-6 py-6"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.25 }}
            >
              <DialogHeader className="min-w-0 space-y-0 text-left">
                <div className="flex items-start gap-4">
                  <motion.div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-[0_0_40px_-10px_rgba(var(--primary),0.35)]"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    {isReconnect ? (
                      <RefreshCw className="h-8 w-8 text-primary" />
                    ) : (
                      <Facebook className="h-8 w-8 text-primary" />
                    )}
                  </motion.div>
                  <motion.div
                    className="min-w-0 pt-1"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12, duration: 0.25 }}
                  >
                    <DialogTitle className="font-display text-xl tracking-tight sm:text-2xl">
                      {isReconnect ? 'Reconnect Account' : 'Connect Facebook Account'}
                    </DialogTitle>
                    <DialogDescription className="mt-2 break-words text-muted-foreground">
                      {isReconnect && reconnectAccountName ? (
                        <>
                          Refresh tokens for{' '}
                          <strong className="text-foreground">{reconnectAccountName}</strong> using your
                          agency&apos;s Facebook App credentials.
                        </>
                      ) : (
                        <>Authorize FBupload Pro using your agency&apos;s configured App credentials.</>
                      )}
                    </DialogDescription>
                  </motion.div>
                </div>
              </DialogHeader>
            </motion.div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-5">
              <div className="mb-5 flex w-full shrink-0 gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
                {MODE_TABS.map((tab) => {
                  const Icon = tab.icon
                  const active = mode === tab.value
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      disabled={isBusy}
                      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:justify-center sm:gap-2 ${
                        active
                          ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => switchMode(tab.value)}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : ''}`} />
                      <span>{tab.label}</span>
                      <span className="hidden text-[10px] font-normal uppercase tracking-wide text-muted-foreground sm:inline">
                        · {tab.description}
                      </span>
                    </button>
                  )
                })}
              </div>

              <AnimatePresence mode="wait">
                {mode === 'direct' ? (
                  <motion.div
                    key="direct"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    className="flex min-w-0 flex-col space-y-4 overflow-y-auto"
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden />
                      <motion.div
                        className="relative space-y-3"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          Secure OAuth flow
                        </div>
                        {error ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center"
                          >
                            <motion.div
                              className="flex items-center justify-center text-sm font-medium text-destructive"
                              animate={{ x: [0, -4, 4, -4, 0] }}
                              transition={{ duration: 0.4 }}
                            >
                              <AlertCircle className="mr-1.5 h-4 w-4 shrink-0" />
                              Configuration Required
                            </motion.div>
                            <p className="break-words text-xs text-muted-foreground">{error}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setOpen(false)
                                router.push('/agency/settings/facebook-byoc')
                              }}
                            >
                              <Settings2 className="mr-2 h-3.5 w-3.5" />
                              Go to Settings
                            </Button>
                          </motion.div>
                        ) : (
                          <p className="break-words text-sm leading-relaxed text-muted-foreground">
                            Recommended if you are logged into Facebook in{' '}
                            <strong className="text-foreground">this</strong> browser. You&apos;ll be
                            redirected to Facebook to approve permissions, then returned here.
                          </p>
                        )}
                      </motion.div>
                    </div>

                    {!error && (
                      <Button
                        onClick={handleConnect}
                        loading={isPending}
                        className="h-12 w-full shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      >
                        {isReconnect ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reconnect in This Browser
                          </>
                        ) : (
                          <>
                            <Facebook className="mr-2 h-4 w-4" />
                            Continue in This Browser
                          </>
                        )}
                      </Button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="magic"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    className="flex min-w-0 flex-col space-y-4 overflow-hidden"
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"
                        aria-hidden
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <div className="relative space-y-2 text-sm">
                        <p className="flex items-center gap-2 font-semibold">
                          <Globe className="h-4 w-4 shrink-0 text-primary" />
                          Cross-Browser Connection
                        </p>
                        <p className="break-words leading-relaxed text-muted-foreground">
                          Use this link to {isReconnect ? 'reconnect' : 'connect'} Facebook accounts logged
                          in on{' '}
                          <strong className="text-foreground">other browsers or devices</strong> without
                          logging into this website there.
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {error && !isGeneratingLink && (
                        <motion.div
                          key="magic-error"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center text-xs text-destructive"
                        >
                          {error}
                        </motion.div>
                      )}

                      {isGeneratingLink ? (
                        <motion.div
                          key="generating"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                            aria-hidden
                          />
                          <motion.div
                            className="relative flex flex-col items-center gap-4 text-center"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="relative flex h-16 w-16 items-center justify-center">
                              <motion.div
                                className="absolute inset-0 rounded-full border-2 border-primary/20"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                              />
                              <motion.div
                                className="absolute inset-2 rounded-full border-2 border-primary/30"
                                animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.2, 0.8] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.2 }}
                              />
                              <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                Generating secure link…
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Creating a one-time connection URL for your account
                              </p>
                            </div>
                            <motion.div
                              className="flex gap-1.5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.3 }}
                            >
                              {[0, 1, 2].map((i) => (
                                <motion.span
                                  key={i}
                                  className="h-1.5 w-1.5 rounded-full bg-primary/70"
                                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                                  transition={{
                                    duration: 0.9,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                    ease: 'easeInOut',
                                  }}
                                />
                              ))}
                            </motion.div>
                          </motion.div>
                        </motion.div>
                      ) : magicLink ? (
                        <motion.div
                          key="link-ready"
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                          className="agency-motion-standard flex min-w-0 flex-col space-y-4 overflow-hidden"
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
                            className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20"
                          >
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </motion.div>
                          <div className="min-w-0 space-y-2">
                            <p className="text-center text-sm font-medium text-foreground">
                              Your secure link is ready
                            </p>
                            <motion.div className="custom-scrollbar w-full overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-3">
                              <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                {magicLink}
                              </p>
                            </motion.div>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-11 w-full shrink-0 rounded-xl font-bold"
                              onClick={copyToClipboard}
                            >
                              {copied ? (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-green-500" />
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
                        </motion.div>
                      ) : (
                        <motion.div
                          key="generate-btn"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                          <Button
                            variant="outline"
                            className="h-12 w-full shrink-0 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                            onClick={handleGenerateMagicLink}
                            disabled={isGeneratingLink}
                          >
                            <Link2 className="mr-2 h-4 w-4 shrink-0" />
                            {isReconnect
                              ? 'Generate Secure Reconnection Link'
                              : 'Generate Secure Connection Link'}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
