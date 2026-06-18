'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Coins,
    Landmark,
    MessageCircle,
    Facebook,
    Copy,
    Instagram,
    Youtube,
    CheckCircle2,
    Wallet,
    Globe
} from "lucide-react"
import React, { useState, type ReactNode } from "react"
import { toast } from "sonner"

type AddTokensDialogProps = {
    trigger?: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AddTokensDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
}: AddTokensDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = onOpenChange ?? setInternalOpen
    const [region, setRegion] = useState<'pakistan' | 'other'>('pakistan')
    const whatsappUrl = "https://wa.me/923278644204"
    const facebookUrl = "https://www.facebook.com/shahzaib.pyc"

    const bankDetails = {
        bank: "UBL",
        accountNo: "313590315",
        iban: "PK77UNIL0109000313590315",
        holder: "SHAH ZAIB MALIK"
    }

    const binanceDetails = {
        id: "983001576",
        name: "Shahzebpyc"
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
    }

    const handleTriggerClick = (e: React.MouseEvent) => {
        e.preventDefault()
        if (open) return
        setOpen(true)
    }

    const defaultTrigger = (
        <Button className="h-12 px-6 font-bold shadow-xl shadow-primary/20">
            <Coins className="mr-2 h-5 w-5" />
            Add Tokens
        </Button>
    )

    const renderTrigger = () => {
        const triggerElement = trigger !== undefined ? trigger : defaultTrigger
        if (!triggerElement) return null

        if (React.isValidElement(triggerElement)) {
            const el = triggerElement as React.ReactElement<{
                disabled?: boolean
                onClick?: React.MouseEventHandler
                'aria-haspopup'?: string
                'aria-expanded'?: boolean
                children?: React.ReactNode
            }>
            return React.cloneElement(el, {
                onClick: (e: React.MouseEvent) => {
                    if (el.props.onClick) {
                        el.props.onClick(e)
                    }
                    handleTriggerClick(e)
                },
                'aria-haspopup': 'dialog',
                'aria-expanded': open,
            })
        }
        return triggerElement
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {renderTrigger()}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col border-border bg-card p-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
                                <Coins className="h-5 w-5 text-primary" />
                            </div>
                            <DialogTitle className="font-display text-2xl font-semibold tracking-tight">Purchase Tokens</DialogTitle>
                        </div>
                        <DialogDescription className="text-muted-foreground font-medium">
                            Follow the steps below to manually top up your account with tokens.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar space-y-6">
                    {/* Token Pricing & Usage Info */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold uppercase tracking-tight">Price</Badge>
                                <p className="text-xl font-semibold tracking-tight text-foreground">0.5 PKR <span className="text-xs text-muted-foreground font-medium">/ Token</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Non-expiring</p>
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-3">
                            <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Successful post costs</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-3 rounded-lg bg-background/50 border border-border flex flex-col items-center gap-1">
                                    <Instagram className="h-4 w-4 text-pink-600" />
                                    <p className="text-sm font-bold">1 Token</p>
                                    <p className="text-xs text-muted-foreground font-medium">Instagram</p>
                                </div>
                                <div className="p-3 rounded-lg bg-background/50 border border-border flex flex-col items-center gap-1">
                                    <svg className="h-4 w-4 fill-current text-foreground" viewBox="0 0 24 24">
                                        <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-3.932 1.353 6.33 6.33 0 0 0-2.454 4.966 6.333 6.333 0 0 0 10.748 4.478 6.333 6.333 0 0 0 2.155-4.478V6.686Z" />
                                    </svg>
                                    <p className="text-sm font-bold">2 Tokens</p>
                                    <p className="text-xs text-muted-foreground font-medium">TikTok</p>
                                </div>
                                <div className="p-3 rounded-lg bg-background/50 border border-border flex flex-col items-center gap-1">
                                    <Facebook className="h-4 w-4 text-blue-600" />
                                    <p className="text-sm font-bold">2 Tokens</p>
                                    <p className="text-xs text-muted-foreground font-medium">Facebook</p>
                                </div>
                                <div className="p-3 rounded-lg bg-background/50 border border-border flex flex-col items-center gap-1">
                                    <Youtube className="h-4 w-4 text-red-600" />
                                    <p className="text-sm font-bold">2 Tokens</p>
                                    <p className="text-xs text-muted-foreground font-medium">YouTube</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Region Selector */}
                    <div className="space-y-3">
                        <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Select payment region</p>
                        <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-xl border border-border/50">
                            <Button
                                variant={region === 'pakistan' ? 'default' : 'ghost'}
                                className={`h-10 gap-2 font-semibold ${region === 'pakistan' ? 'shadow-md' : ''}`}
                                onClick={() => setRegion('pakistan')}
                            >
                                <CheckCircle2 className={`h-4 w-4 ${region === 'pakistan' ? 'opacity-100' : 'opacity-0'}`} />
                                Pakistan
                            </Button>
                            <Button
                                variant={region === 'other' ? 'default' : 'ghost'}
                                className={`h-10 gap-2 font-semibold ${region === 'other' ? 'shadow-md' : ''}`}
                                onClick={() => setRegion('other')}
                            >
                                <Globe className={`h-4 w-4 ${region === 'other' ? 'opacity-100' : 'opacity-0'}`} />
                                Others
                            </Button>
                        </div>
                    </div>

                    {/* Step 1: Payment Details */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Badge className="flex h-6 w-6 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground">1</Badge>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                                {region === 'pakistan' ? 'Bank Transfer' : 'Binance Transfer'}
                            </h3>
                        </div>

                        {region === 'pakistan' ? (
                            <div className="grid gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Landmark className="h-12 w-12" />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Bank name</p>
                                    <p className="font-bold text-foreground">{bankDetails.bank}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Account holder</p>
                                    <p className="font-bold text-foreground uppercase slashed-zero">{bankDetails.holder}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 relative">
                                        <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Account number</p>
                                        <div className="flex items-center justify-between">
                                            <p className="font-mono text-lg font-semibold tracking-tight text-primary">{bankDetails.accountNo}</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-primary/20 hover:text-primary transition-all"
                                                onClick={() => copyToClipboard(bankDetails.accountNo, "Account Number")}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1 relative">
                                        <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">IBAN</p>
                                        <div className="flex items-center justify-between">
                                            <p className="font-mono text-xs font-semibold tracking-tight text-primary break-all">{bankDetails.iban}</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-primary/20 hover:text-primary transition-all"
                                                onClick={() => copyToClipboard(bankDetails.iban, "IBAN")}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Wallet className="h-12 w-12" />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Platform</p>
                                    <p className="font-bold text-foreground">Binance</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Name</p>
                                    <p className="font-bold text-foreground uppercase">{binanceDetails.name}</p>
                                </div>

                                <div className="space-y-1 relative">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">Binance ID</p>
                                    <div className="flex items-center justify-between">
                                        <p className="font-mono text-lg font-semibold tracking-tight text-primary">{binanceDetails.id}</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-primary/20 hover:text-primary transition-all"
                                            onClick={() => copyToClipboard(binanceDetails.id, "Binance ID")}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator className="opacity-50" />

                    {/* Step 2: Confirmation */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Badge className="flex h-6 w-6 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground">2</Badge>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Confirmation</h3>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Once payment is made, take a screenshot of the transaction and send it to us via one of the channels below.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
                                <Button variant="outline" className="w-full h-12 font-bold gap-2 border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:text-green-600 transition-all">
                                    <MessageCircle className="h-4 w-4" />
                                    WhatsApp
                                </Button>
                            </a>
                            <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="block">
                                <Button variant="outline" className="w-full h-12 font-bold gap-2 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-600 transition-all">
                                    <Facebook className="h-4 w-4" />
                                    Messenger
                                </Button>
                            </a>
                        </div>
                    </div>

                    {/* Final Notice */}
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 flex items-start space-x-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                        <div className="text-xs space-y-1">
                            <p className="font-semibold uppercase tracking-wide text-primary">Verification protocol</p>
                            <p className="text-muted-foreground font-medium">After verification, tokens will be allocated to your account within <span className="text-foreground font-bold italic">15-30 minutes</span>.</p>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    )
}
