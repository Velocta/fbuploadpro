'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Facebook, ShieldCheck, AlertCircle, Trash2, Info, Eye, EyeOff, Youtube, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AgencySettings } from '@/types/app.types'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getMainDomain } from '@/lib/config/runtime'
import { AgencyEmptyState, AgencySectionCard } from '@/components/dashboard/agency'

export function AgencySettingsClient({ initialSettings }: { initialSettings: AgencySettings | null }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [showSecret, setShowSecret] = useState(false)
    const [step, setStep] = useState(1)

    const hasCredentials = !!initialSettings?.fb_app_id

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
    }, [])

    const mainDomain = getMainDomain()
    const protocol = mounted && typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http'
    const currentHost = mounted && typeof window !== 'undefined' ? window.location.host : mainDomain
    const isMainDomain = currentHost === mainDomain || currentHost === `www.${mainDomain}` || currentHost === 'localhost:3000'
    const isSubdomain = !isMainDomain && currentHost.includes(`.${mainDomain}`)
    const actualHost = isSubdomain ? currentHost : (initialSettings?.subdomain ? `${initialSettings.subdomain}.${mainDomain}` : mainDomain)


    // Override callbackUrl to use the subdomain if available
    const callbackUrl = `${protocol}://${actualHost}/agency/facebook/accounts/callback`
    const magicCallbackUrl = `${protocol}://${actualHost}/fb-callback`

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
            const res = await fetch('/api/v1/agency/settings/facebook-app', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fb_app_id: formData.get('fb_app_id'),
                    fb_app_secret: formData.get('fb_app_secret'),
                }),
            })
            const result = await res.json().catch(() => null)
            if (!res.ok || result?.error) {
                const message = result?.error || 'Failed to update settings'
                setError(message)
                toast.error('Verification Failed', {
                    description: message,
                })
            } else {
                setIsEditing(false)
                setShowSecret(false)
                setStep(1)
                toast.success('Credentials Verified', {
                    description: `Successfully connected to Facebook App: ${result?.appName}`,
                })
                window.location.reload()
            }
        })
    }

    const handleDelete = () => {
        setError(null)
        startTransition(async () => {
            const res = await fetch('/api/v1/agency/settings/facebook-app', { method: 'DELETE' })
            const result = await res.json().catch(() => null)
            if (!res.ok || result?.error) {
                const message = result?.error || 'Failed to delete settings'
                setError(message)
                toast.error('Action Restricted', {
                    description: message,
                })
            } else {
                setIsEditing(false)
                setShowSecret(false)
                setStep(1)
                toast.success('Credentials Removed')
                window.location.reload()
            }
        })
    }

    if (!hasCredentials && !isEditing) {
        return (
            <div className="max-w-2xl">
                <AgencyEmptyState
                    icon={<Facebook className="h-6 w-6" />}
                    title="No Facebook App configured"
                    description="To start connecting Facebook accounts and automating pages, configure your own Facebook App credentials (BYOC)."
                    action={{ label: 'Setup Facebook app', onClick: () => setIsEditing(true) }}
                />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <AgencySectionCard className="overflow-hidden border-primary/20">
                <CardHeader className="bg-primary/5 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Facebook className="h-5 w-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">BYOC Configuration</span>
                        </div>
                        {!isEditing && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Remove
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Facebook Credentials?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will disconnect your Facebook App. You cannot do this if you have active accounts or pages connected.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Confirm Removal
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <CardTitle className="text-2xl">
                        {isEditing && !hasCredentials ? `Step ${step}: ${step === 1 ? 'Create App' :
                            step === 2 ? 'Privacy Settings' :
                                step === 3 ? 'Go Live' :
                                    step === 4 ? 'Auth Redirect' : 'Verification'
                            }` : initialSettings?.fb_app_name || 'Facebook App'}
                    </CardTitle>
                    {!isEditing && (
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                            App ID: {initialSettings?.fb_app_id}
                        </p>
                    )}
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-6">
                        {isEditing ? (
                            <div className="space-y-6">
                                {/* STEP 1: CREATE APP */}
                                {step === 1 && !hasCredentials && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-start gap-3 p-4 bg-muted/30 border rounded-lg">
                                            <Youtube className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold">Create your Developer App</p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Go to the <a href="https://developers.facebook.com/apps" target="_blank" className="text-primary font-bold hover:underline">Facebook Developers Portal</a> and create a new App.
                                                    You can follow this tutorial for step-by-step guidance:
                                                </p>
                                                <a
                                                    href="https://youtu.be/ObS7MM-zAeQ?si=KzD522lZ7i1sSME-"
                                                    target="_blank"
                                                    className="flex items-center gap-2 text-xs font-bold text-destructive hover:text-destructive/90 bg-destructive/10 w-fit px-3 py-1.5 rounded-full border border-destructive/20"
                                                >
                                                    <Youtube className="h-4 w-4" />
                                                    Watch Setup Tutorial
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: PRIVACY POLICY */}
                                {step === 2 && !hasCredentials && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">1</span>
                                                <p className="text-sm font-semibold">Set Privacy Policy URL</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                                                In your FB App Dashboard, go to <strong>App Settings &gt; Basic</strong> in the left panel.
                                                Copy and paste the URL below into the <strong>Privacy Policy URL</strong> field:
                                            </p>
                                            <div className="pl-7">
                                                <code className="block break-all select-all bg-muted px-2 py-1.5 rounded border text-xs font-mono text-primary">
                                                    {`${protocol}://${actualHost}/privacy`}
                                                </code>
                                            </div>
                                            <div className="flex items-center gap-2 mt-4 pl-7">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">2</span>
                                                <p className="text-sm font-semibold">Save Changes</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground pl-14">
                                                Scroll to the bottom of the page and click the <strong>Save changes</strong> button.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: GO LIVE */}
                                {step === 3 && !hasCredentials && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                                            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-primary">Activate App Live Mode</p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Look at the top bar of your Facebook Developer dashboard.
                                                    Find the toggle that says <strong>App Mode: Development</strong> and switch it to <strong>Live</strong>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: OAUTH REDIRECT */}
                                {step === 4 && !hasCredentials && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">1</span>
                                                <p className="text-sm font-semibold">Add Facebook Login for Business</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                                                In the left side panel, click <strong>Add Product</strong> and find <strong>Facebook Login for Business</strong>.
                                                If you already see it in your sidebar, skip this step.
                                            </p>

                                            <div className="flex items-center gap-2 mt-4 pl-7">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">2</span>
                                                <p className="text-sm font-semibold">Configure Redirect URI</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground pl-14 leading-relaxed">
                                                Go to <strong>Facebook Login for Business &gt; Settings</strong>.
                                                Paste this URL into <strong>Valid OAuth Redirect URIs</strong> and click <strong>Save changes</strong>:
                                            </p>
                                            <div className="pl-14 space-y-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-tight">Direct Connection Callback</p>
                                                    <code className="block break-all select-all bg-background px-2 py-1.5 rounded border text-xs font-mono text-primary shadow-sm hover:border-primary/50 transition-colors">
                                                        {callbackUrl || 'Loading...'}
                                                    </code>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-tight">Magic Link Callback</p>
                                                    <code className="block break-all select-all bg-background px-2 py-1.5 rounded border text-xs font-mono text-primary shadow-sm hover:border-primary/50 transition-colors">
                                                        {magicCallbackUrl || 'Loading...'}
                                                    </code>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 5 / EDIT: CREDENTIALS */}
                                {(step === 5 || hasCredentials) && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="space-y-2">
                                            <Label htmlFor="fb_app_id">Facebook App ID</Label>
                                            <Input
                                                id="fb_app_id"
                                                name="fb_app_id"
                                                defaultValue={initialSettings?.fb_app_id || ''}
                                                placeholder="1234567890"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                required
                                                disabled={hasCredentials}
                                                className={hasCredentials ? "bg-muted cursor-not-allowed" : ""}
                                            />
                                            {hasCredentials && (
                                                <p className="text-xs text-muted-foreground italic">
                                                    App ID cannot be changed. Remove credentials to use a different App ID.
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="fb_app_secret">Facebook App Secret</Label>
                                            <div className="relative">
                                                <Input
                                                    id="fb_app_secret"
                                                    name="fb_app_secret"
                                                    type={showSecret ? "text" : "password"}
                                                    defaultValue={initialSettings?.fb_app_secret || ''}
                                                    placeholder="••••••••••••••••"
                                                    required
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-0 top-0 h-10 w-10 p-0 hover:bg-transparent"
                                                    onClick={() => setShowSecret(!showSecret)}
                                                >
                                                    {showSecret ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground pt-1">
                                                Found in <strong>App Settings &gt; Basic</strong> of your FB Developer dashboard.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                    <div className="text-sm">
                                        <p className="font-bold text-primary">App Credentials Verified</p>
                                        <p className="text-primary/80 text-xs">Your agency is ready to connect Facebook accounts.</p>
                                    </div>
                                </div>

                                <div className="px-4 py-3 bg-muted/20 border rounded-lg flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">App Secret</p>
                                        <p className="font-mono text-sm">
                                            {showSecret ? initialSettings?.fb_app_secret : '••••••••••••••••'}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-muted/50"
                                        onClick={() => setShowSecret(!showSecret)}
                                    >
                                        {showSecret ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs font-medium">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="bg-muted/20 border-t py-4 px-6 flex justify-between">
                        {isEditing ? (
                            <>
                                <div className="flex gap-2">
                                    {step > 1 && !hasCredentials && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                                            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                                        </Button>
                                    )}
                                    <Button type="button" variant="ghost" size="sm" onClick={() => { setIsEditing(false); setShowSecret(false); setStep(1); }}>
                                        Cancel
                                    </Button>
                                </div>

                                {step < 5 && !hasCredentials ? (
                                    <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
                                        Next Step <ArrowRight className="h-4 w-4 ml-1.5" />
                                    </Button>
                                ) : (
                                    <Button type="submit" loading={isPending} className="bg-primary hover:bg-primary/90 shadow-md text-primary-foreground">
                                        Verify & Save
                                    </Button>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                                    <Info className="h-3 w-3" />
                                    Remove existing accounts to update App ID.
                                </p>
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    Update Credentials
                                </Button>
                            </div>
                        )}
                    </CardFooter>
                </form>
            </AgencySectionCard>

        </div>
    )
}
