'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useState, useEffect } from 'react'

const navLinks = [
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'Calculator', href: '#monthly-calculator' },
  { name: 'Pricing', href: '#pricing' },
]

const easeStandard = [0.2, 0, 0, 1] as const

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${isScrolled ? 'bg-background/90 backdrop-blur-md border-b border-border py-3' : 'bg-transparent py-5'
        }`}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.12 : 0.22,
        ease: easeStandard,
      }}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md">
          <div className="relative w-8 h-8">
            <Image src="/logo.svg" alt="FBupload Pro Logo" width={32} height={32} className="h-8 w-8" />
          </div>
          <span className="text-xl font-display font-bold tracking-tight whitespace-nowrap">FBupload Pro</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-semibold text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-border" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-sm font-semibold px-4" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button className="text-sm font-semibold px-6 rounded-full group" asChild>
              <Link href="/login">
                Dashboard
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l border-border bg-background">
              <SheetHeader className="text-left mb-12">
                <SheetTitle className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
                  <Image src="/logo.svg" alt="Logo" width={32} height={32} />
                  FBupload Pro
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="text-lg font-semibold text-muted-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="h-[1px] w-full bg-border my-2" />
                <Button variant="outline" className="w-full text-md font-semibold h-14 rounded-xl border-border" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button className="w-full text-md font-semibold h-14 rounded-xl" asChild>
                  <Link href="/login">Go to Dashboard</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  )
}
