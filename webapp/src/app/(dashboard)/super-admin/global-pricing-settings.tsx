'use client'

import { useState, useEffect, useTransition } from 'react'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Coins, Save, Landmark, AlertCircle } from 'lucide-react'
import { getTokenPrice, updateTokenPrice } from './settings-actions'
import { toast } from 'sonner'
import { AgencySectionCard } from '@/components/dashboard/agency'

export function GlobalPricingSettings() {
    const [price, setPrice] = useState<number>(0.5)
    const [isPending, startTransition] = useTransition()
    const [isFetching, setIsFetching] = useState(true)

    useEffect(() => {
        getTokenPrice().then((val) => {
            setPrice(val)
            setIsFetching(false)
        })
    }, [])

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateTokenPrice(price)
            if (result.success) {
                toast.success('Global token price updated successfully')
            } else {
                toast.error(result.error || 'Failed to update price')
            }
        })
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <AgencySectionCard className="border-primary/20">
                <CardHeader className="border-b border-primary/10 bg-primary/5">
                    <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Landmark className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Global Pricing</CardTitle>
                            <CardDescription>Set the platform-wide token exchange rate</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tokenPrice" className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                                <Coins className="h-4 w-4 mr-2" />
                                Token Price (PKR per Token)
                            </Label>
                            <div className="relative group">
                                <Input
                                    id="tokenPrice"
                                    type="number"
                                    step="0.01"
                                    className="h-12 border-border pl-4 text-lg font-semibold transition-all focus-visible:ring-primary/20"
                                    value={price}
                                    onChange={(e) => setPrice(Number(e.target.value))}
                                    disabled={isFetching || isPending}
                                />
                            </div>
                            <p className="mt-1 flex items-center text-xs italic text-muted-foreground">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                This rate will be used to automatically calculate token allocations in the Admin dashboard.
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-6">
                            <div className="space-y-1">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview calculation</p>
                                <p className="text-sm font-medium">10,000 PKR will allocate:</p>
                            </div>
                            <div className="flex items-center text-3xl font-semibold text-primary">
                                {(10000 / (price || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                <span className="mb-1 ml-2 self-end text-sm font-semibold uppercase tracking-wide">Tokens</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        className="h-12 w-full text-base font-semibold shadow-sm"
                        onClick={handleSave}
                        loading={isPending}
                        disabled={isFetching || price <= 0}
                    >
                        <Save className="h-5 w-5 mr-2" />
                        Save Configuration
                    </Button>
                </CardContent>
            </AgencySectionCard>

            <AgencySectionCard className="agency-surface-card-muted border-primary/20">
                <CardContent className="p-4 flex items-start space-x-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold uppercase tracking-wide text-foreground">Important notice</p>
                        <p>Changing the global price will immediately affect all future top-ups. Previous transactions and historical logs will remain unchanged for audit integrity.</p>
                    </div>
                </CardContent>
            </AgencySectionCard>
        </div>
    )
}
