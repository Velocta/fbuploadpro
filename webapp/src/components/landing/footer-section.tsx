'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

const easeStandard = [0.2, 0, 0, 1] as const

export function FooterSection() {
  const reduce = useReducedMotion()

  const gridContainer = {
    hidden: {},
    visible: {
      transition: reduce
        ? { duration: 0.2 }
        : { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  }

  const column = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { y: 0 }),
      transition: reduce
        ? { duration: 0.2, ease: easeStandard }
        : { duration: 0.36, ease: easeStandard },
    },
  }

  const bottomBar = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { y: 0 }),
      transition: reduce
        ? { duration: 0.2, ease: easeStandard }
        : { duration: 0.32, ease: easeStandard, delay: 0.12 },
    },
  }

  return (
    <footer className="border-t border-border bg-muted/30 py-20 dark:bg-muted/15">
      <div className="container mx-auto px-4">
        <motion.div
          className="grid gap-10 md:grid-cols-2 lg:grid-cols-4"
          variants={gridContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={column} className="space-y-5">
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
          </motion.div>

          <motion.div variants={column}>
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
          </motion.div>

          <motion.div variants={column}>
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
          </motion.div>

          <motion.div variants={column}>
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
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row"
          variants={bottomBar}
          initial="hidden"
          animate="visible"
        >
          <span>© {new Date().getFullYear()} FBupload Pro</span>
          <span>Secure operations • Encrypted workflows • Automated publishing</span>
        </motion.div>
      </div>
    </footer>
  )
}
