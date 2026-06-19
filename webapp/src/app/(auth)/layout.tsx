import React from 'react'
import Image from 'next/image'
import { headers } from 'next/headers'
import { getBrandConfig } from '@/lib/config/brand'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const host = headersList.get('host') || 'fbuploadpro.com'
  const brand = getBrandConfig(host)

  // Split brand name to style first and second parts beautifully
  const brandParts = brand.name.split(' ')
  const mainPart = brandParts[0]
  const subPart = brandParts.slice(1).join(' ')

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary sm:px-6 lg:px-8">
      <div className="auth-atmosphere-radials" aria-hidden />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
            <Image
              src={brand.logoUrl}
              alt={`${brand.name} Logo`}
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {mainPart} {subPart && <span className="text-primary">{subPart}</span>}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Agency automation portal
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

