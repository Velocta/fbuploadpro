'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddTokensDialog } from './add-tokens-dialog'
import { useBrand } from '@/components/brand-provider'

/** Opens the purchase dialog when user lands on /agency?addTokens=1 from a locked sidebar link. */
export function AddTokensAutoOpen() {
  const searchParams = useSearchParams()
  const shouldOpen = searchParams.get('addTokens') === '1'
  const [open, setOpen] = useState(false)
  const brand = useBrand()

  useEffect(() => {
    if (shouldOpen && !brand.hideAddTokens) {
      const t = setTimeout(() => setOpen(true), 0)
      return () => clearTimeout(t)
    }
  }, [shouldOpen, brand.hideAddTokens])

  if (brand.hideAddTokens) return null
  if (!shouldOpen && !open) return null

  return (
    <AddTokensDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<span className="sr-only">Add tokens</span>}
    />
  )
}
