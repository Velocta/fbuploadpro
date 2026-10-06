'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Coins,
  Globe
} from 'lucide-react'
import { GlobalPricingSettings } from './global-pricing-settings'
import { AgencyListItem } from './agencies-view'
import { AgencyPageHeader, AgencySectionCard } from '@/components/dashboard/agency'
import type { Database } from '@/types/database.types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type PageListItem = {
  id: string
  agency_id: string
  page_name: string
  status: Database['public']['Enums']['profile_status_enum'] | null
  sync_status: Database['public']['Enums']['sync_status_enum'] | null
  source_platform: Database['public']['Enums']['source_platform_enum'] | null
  followers_count: number | null
}

interface SuperAdminDashboardClientProps {
  initialData: {
    agencies: AgencyListItem[]
    pages: PageListItem[]
    activePagesCount: number
    tokensUsedToday: number
  }
}

export function SuperAdminDashboardClient({ initialData }: SuperAdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const tabLabelMap: Record<string, string> = {
    dashboard: 'Dashboard',
    pricing_settings: 'Pricing & Tokens',
  }

  const stats = useMemo(() => {
    return {
      totalAgencies: initialData.agencies.length,
      totalActivePages: initialData.activePagesCount,
      tokensUsedToday: initialData.tokensUsedToday,
    }
  }, [initialData])

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Overview', href: '/super-admin' },
          { label: tabLabelMap[activeTab] || 'Dashboard' }
        ]}
      />
      <AgencyPageHeader
        title="Super-admin overview"
        description="Monitor platform health, manage agencies, and control pricing configuration."
        className="pb-5"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/super-admin">Overview</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/super-admin/agencies">Agencies</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="dashboard" className="w-full" onValueChange={setActiveTab}>
        <div className="flex justify-center">
          <TabsList className="rounded-lg border border-border/70 bg-muted/50 p-1">
            <TabsTrigger
              value="dashboard"
              className="rounded-md px-6 py-2 transition-all"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="pricing_settings"
              className="rounded-md px-6 py-2 transition-all"
            >
              Pricing & Tokens
            </TabsTrigger>
          </TabsList>
        </div>

        <Separator className="mt-4" />

        <div className="mt-8">
          <TabsContent value="dashboard" className="space-y-8 agency-motion-standard">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Platform stats</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">

              <AgencySectionCard className="hover:border-primary/25 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Agencies</CardTitle>
                  <Building2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAgencies}</div>
                  <p className="text-xs text-muted-foreground">Client accounts created</p>
                </CardContent>
              </AgencySectionCard>


              <AgencySectionCard className="hover:border-primary/25 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Pages</CardTitle>
                  <Globe className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalActivePages}</div>
                  <p className="text-xs text-muted-foreground">Pages with status &apos;active&apos;</p>
                </CardContent>
              </AgencySectionCard>

              <AgencySectionCard className="hover:border-primary/25 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tokens Used Today</CardTitle>
                  <Coins className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.tokensUsedToday}</div>
                  <p className="text-xs text-muted-foreground">
                    Tokens spent across all agencies today (PKT)
                  </p>
                </CardContent>
              </AgencySectionCard>
            </div>
          </TabsContent>

          <TabsContent value="pricing_settings" className="agency-motion-standard">
            <GlobalPricingSettings />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
