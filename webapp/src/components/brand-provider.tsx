'use client'

import React, { createContext, useContext } from 'react'
import type { BrandConfig } from '@/lib/config/brand'

const BrandContext = createContext<BrandConfig | null>(null)

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandConfig
  children: React.ReactNode
}) {
  return (
    <BrandContext.Provider value={brand}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  const context = useContext(BrandContext)
  if (!context) {
    // Default fallback brand for testing or context-less rendering
    return {
      name: 'FBupload Pro',
      domain: 'fbuploadpro.com',
      supportEmail: 'support@fbuploadpro.com',
      logoUrl: '/logo.svg',
      hideLanding: false,
      hideSignup: false,
      hideForgotPassword: false,
    }
  }
  return context
}
