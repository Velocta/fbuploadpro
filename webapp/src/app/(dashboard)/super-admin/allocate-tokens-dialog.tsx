'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Coins, Plus } from 'lucide-react'
import { allocateTokens, getTokenPrice } from './super-admin-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AllocateTokensDialogProps {
    agencyId: string
    agencyName: string
}

export function AllocateTokensDialog({ agencyId, agencyName }: AllocateTokensDialogProps) {
    const [open, setOpen] = useState(false)
    const [amountPaid, setAmountPaid] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [tokenPrice, setTokenPrice] = useState<number>(0.6)
    const router = useRouter()

    useEffect(() => {
        if (open) {
            getTokenPrice().then(setTokenPrice)
        }
    }, [open])

    const calculatedTokens = amountPaid ? Math.floor(Number(amountPaid) / tokenPrice) : 0

    const handleAllocate = async (e: React.FormEvent) => {
        e.preventDefault()
        const numAmount = Number(amountPaid)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Please enter a valid amount.')
            return
        }

        setLoading(true)
        try {
            const result = await allocateTokens(agencyId, numAmount, notes)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(result.message)
                setOpen(false)
                setAmountPaid('')
                setNotes('')
                router.refresh()
            }
        } catch (err) {
            console.error('Allocation Error:', err)
            toast.error('Allocation failed. Please try again or verify payment details.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1 border-primary/20 hover:bg-primary/5 hover:text-primary">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Tokens</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAllocate}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-primary" />
                            Allocate Tokens
                        </DialogTitle>
                        <DialogDescription>
                            Enter payment details for <strong>{agencyName}</strong>. Tokens are auto-calculated at <strong>{tokenPrice} PKR/Token</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount Paid (PKR)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="e.g. 500"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                min="1"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                ≈ <span className="font-bold text-primary">{calculatedTokens} Tokens</span> will be added.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes (Internal)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Reference ID, payment method, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Allocating...' : 'Confirm Allocation'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
