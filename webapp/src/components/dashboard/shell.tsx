'use client'

import { useState } from 'react'
import Image from 'next/image'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, BarChart3, Building2, UserCircle, Settings, Menu, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from '@/components/ui/badge'

interface DashboardShellProps {
    children: React.ReactNode
    user: {
        name: string
        role: string
        tokens_balance: number
    }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    // Determine role based on path
    const isSuperAdmin = pathname.startsWith('/super-admin')
    const isAdmin = pathname.startsWith('/admin')
    const isAgency = pathname.startsWith('/agency')

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    const navItems = []
    const hasTokens = user.tokens_balance > 0

    if (isSuperAdmin) {
        navItems.push(
            { name: 'Overview', href: '/super-admin', icon: BarChart3 }
        )
    } else if (isAdmin) {
        navItems.push(
            { name: 'Overview', href: '/admin', icon: BarChart3 },
            { name: 'Agencies', href: '/admin/agencies', icon: Building2 }
        )
    } else if (isAgency) {
        navItems.push(
            { name: 'Overview', href: '/agency', icon: BarChart3 }
        )

        if (hasTokens) {
            navItems.push(
                { name: 'FB Accounts', href: '/agency/facebook', icon: Building2 },
                { name: 'Pages', href: '/agency/pages', icon: UserCircle },
                { name: 'Page Tools', href: '/agency/page-tools', icon: Menu },
                { name: 'Settings', href: '/agency/settings', icon: Settings }
            )
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
            {/* Topbar Layout */}
            <header className="bg-sidebar/80 backdrop-blur-md border-b border-sidebar-border sticky top-0 z-50 px-6">
                <div className="w-full flex justify-between items-center h-16">
                    {/* Start: Webapp Name */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                            <Image src="/logo.svg" alt="Logo" width={20} height={20} className="h-5 w-5" />
                        </div>
                        <p className="font-display font-black text-xl tracking-tighter text-foreground">
                            FBupload <span className="text-primary italic">Pro</span>
                        </p>
                    </div>

                    {/* Middle: Navigation */}
                    <div className="flex-1 flex justify-center h-full">
                        <nav className="hidden md:flex space-x-2 h-full items-center">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center px-4 h-10 rounded-full text-sm font-bold transition-all border border-transparent",
                                        pathname === item.href
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* End: User Info + Logout */}
                    <div className="flex items-center space-x-6">
                        {isAgency && (
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <Badge variant="outline" className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary py-1 px-3 rounded-full flex items-center gap-2 transition-colors">
                                    <Coins className="h-3.5 w-3.5" />
                                    <span className="font-bold text-xs">{user.tokens_balance.toLocaleString()} Tokens</span>
                                </Badge>
                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 mr-1">Available Balance</p>
                            </div>
                        )}
                        <div className="text-right leading-none hidden md:block">
                            <p className="text-sm font-bold text-foreground mb-0.5">{user.name}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display font-medium">
                                {user.role?.replace('_', ' ')}
                            </p>
                        </div>
                        <div className="h-8 w-[1px] bg-border hidden md:block" />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11 w-11 rounded-full transition-all hidden md:flex"
                            onClick={handleSignOut}
                            title="Sign Out"
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>

                        {/* Mobile Menu */}
                        <div className="md:hidden">
                            <Sheet open={open} onOpenChange={setOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10">
                                        <Menu className="h-6 w-6" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                                    <SheetHeader className="mb-8 text-left">
                                        <SheetTitle className="flex items-center gap-2 text-xl font-display font-black">
                                            <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                                                <Image src="/logo.svg" alt="Logo" width={20} height={20} className="h-5 w-5" />
                                            </div>
                                            FBupload <span className="text-primary italic">Pro</span>
                                        </SheetTitle>
                                    </SheetHeader>

                                    <div className="flex flex-col space-y-4">
                                        {/* Navigation Links */}
                                        <div className="flex flex-col space-y-2">
                                            {navItems.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setOpen(false)}
                                                    className={cn(
                                                        "flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent",
                                                        pathname === item.href
                                                            ? "bg-primary text-primary-foreground shadow-sm"
                                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    )}
                                                >
                                                    <item.icon className="mr-3 h-5 w-5" />
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </div>

                                        <div className="h-[1px] bg-border my-4" />

                                        {/* User Info & Logout */}
                                        <div className="flex flex-col space-y-4 px-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{user.name}</p>
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display mt-0.5">
                                                        {user.role?.replace('_', ' ')}
                                                    </p>
                                                </div>
                                                {isAgency && (
                                                    <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary flex items-center gap-1.5 py-1">
                                                        <Coins className="h-3 w-3" />
                                                        <span className="font-bold text-[10px]">{user.tokens_balance}</span>
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                                                onClick={() => {
                                                    setOpen(false)
                                                    handleSignOut()
                                                }}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Sign Out
                                            </Button>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    )
}
