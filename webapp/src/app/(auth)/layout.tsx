import React from 'react'
import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
              src="/logo.svg"
              alt="FBupload Pro Logo"
              width={40}
              height={40}
              className="h-10 w-10"
            />
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
            FBupload <span className="text-primary">Pro</span>
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
