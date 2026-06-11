'use client'

import { useState } from 'react'
import {
  Activity,
  BarChart3,
  Film,
  Settings2,
  AlertTriangle,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type TabId = 'overview' | 'insights' | 'reels' | 'failed-posts' | 'settings'

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'reels', label: 'Reels', icon: Film },
  { id: 'failed-posts', label: 'Failed Posts Reasons', icon: AlertTriangle },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function PageDetailTabs({
  overview,
  insights,
  reels,
  failedPosts,
  settings,
}: {
  overview: ReactNode
  insights: ReactNode
  reels: ReactNode
  failedPosts: ReactNode
  settings: ReactNode
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const panels: Record<TabId, ReactNode> = {
    overview,
    insights,
    reels,
    'failed-posts': failedPosts,
    settings,
  }

  return (
    <div className="space-y-6">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex w-full flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all min-w-[120px]',
                    selected
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`adu-tab-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`adu-tab-btn-${tab.id}`}
          hidden={activeTab !== tab.id}
          className={cn(
            'agency-motion-standard',
            activeTab === tab.id ? 'block animate-in fade-in duration-200' : 'hidden',
          )}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  )
}
