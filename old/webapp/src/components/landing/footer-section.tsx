'use client'

import Image from 'next/image'
import Link from 'next/link'

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-muted/30 py-20 dark:bg-muted/15">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-5">
            <Link
              href="/"
              className="inline-flex items-center space-x-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-2">
                <Image src="/logo.svg" alt="FBupload Pro Logo" width={32} height={32} className="h-8 w-8" />
              </div>
              <span className="text-xl font-display font-bold tracking-tight">FBupload Pro</span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A reliable distribution platform for agencies running Facebook growth workflows.
            </p>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="#how-it-works" className="transition-colors duration-200 hover:text-primary">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#monthly-calculator" className="transition-colors duration-200 hover:text-primary">
                  Calculator
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="transition-colors duration-200 hover:text-primary">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="transition-colors duration-200 hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors duration-200 hover:text-primary">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@fbuploadpro.com"
                  className="cursor-pointer rounded-sm transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  support@fbuploadpro.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Contact</h4>
            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-5">
              <p className="font-semibold text-foreground">Shahzeb Malik</p>
              <p className="text-xs text-muted-foreground">Founder</p>
              <a
                href="https://wa.me/923278644204"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                WhatsApp
              </a>
              <a
                href="https://www.facebook.com/shahzaib.pyc"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full cursor-pointer rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Facebook
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} FBupload Pro</span>
          <span>Secure operations • Encrypted workflows • Automated publishing</span>
        </div>
      </div>
    </footer>
  )
}
