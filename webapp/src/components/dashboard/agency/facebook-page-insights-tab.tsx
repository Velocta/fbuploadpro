'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertCircle,
  Users,
  ThumbsUp,
  Globe2,
  Building2,
  RefreshCw,
  Activity,
  Video,
  BarChart3,
  TrendingUp,
  Calendar,
  Heart,
  PlayCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Line,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts'
import { cn } from '@/lib/utils'

export type FacebookPageInsightsTabProps = {
  fbPageId: string
  pageAccessToken: string
}

interface DemographicsData {
  country: { name: string; count: number; percentage: number }[]
  city: { name: string; count: number; percentage: number }[]
}

interface ChartDataPoint {
  date: string
  [key: string]: any
}

const METRICS_LIST = [
  'page_follows',
  'page_daily_follows_unique',
  'page_daily_unfollows_unique',
  'page_media_view',
  'page_total_media_view_unique',
  'page_views_total',
  'page_post_engagements',
  'page_total_actions',
  'page_video_views',
  'page_video_views_unique',
  'page_video_complete_views_30s',
  'page_video_view_time',
  'page_actions_post_reactions_like_total',
  'page_actions_post_reactions_love_total',
  'page_actions_post_reactions_wow_total',
  'page_actions_post_reactions_haha_total',
  'page_actions_post_reactions_sorry_total',
  'page_actions_post_reactions_anger_total',
].join(',')

export function FacebookPageInsightsTab({ fbPageId, pageAccessToken }: FacebookPageInsightsTabProps) {
  const [dateRange, setDateRange] = useState<number>(28)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [pageInfo, setPageInfo] = useState<{ fan_count: number; followers_count: number } | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)

  const [retryCount, setRetryCount] = useState(0)
  const [chartsReady, setChartsReady] = useState(false)

  useEffect(() => {
    if (loading) {
      setChartsReady(false)
      return
    }
    let frame2 = 0
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setChartsReady(true))
    })
    return () => {
      cancelAnimationFrame(frame1)
      if (frame2) cancelAnimationFrame(frame2)
    }
  }, [loading])

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    const fetchData = async () => {
      if (!fbPageId || !pageAccessToken) {
        setError('Invalid Page configuration or Access Token.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const untilDate = new Date()
        const sinceDate = subDays(untilDate, dateRange)
        
        const since = Math.floor(sinceDate.getTime() / 1000)
        const until = Math.floor(untilDate.getTime() / 1000)

        // 1. Fetch Page Info
        const pageInfoRes = await fetch(
          `https://graph.facebook.com/v25.0/${fbPageId}?fields=fan_count,followers_count&access_token=${pageAccessToken}`,
          { signal }
        )
        if (!pageInfoRes.ok) throw new Error('Failed to fetch Facebook Page overview data.')
        const infoData = await pageInfoRes.json()
        setPageInfo({
          fan_count: infoData.fan_count ?? 0,
          followers_count: infoData.followers_count ?? 0
        })

        // 2. Fetch Time Series Insights
        const insightsRes = await fetch(
          `https://graph.facebook.com/v25.0/${fbPageId}/insights?metric=${METRICS_LIST}&period=day&since=${since}&until=${until}&access_token=${pageAccessToken}`,
          { signal }
        )
        
        if (!insightsRes.ok) {
          const errObj = await insightsRes.json()
          console.error('FB API Error:', errObj)
          throw new Error(errObj.error?.message || 'Failed to fetch time-series insights.')
        }
        
        const insightsData = await insightsRes.json()

        // Process Time Series Data
        const daysMap = new Map<string, ChartDataPoint>()
        
        // Initialize map with empty dates
        for (let i = dateRange - 1; i >= 0; i--) {
          const dateStr = format(subDays(untilDate, i), 'MMM dd')
          daysMap.set(dateStr, { date: dateStr })
        }

        insightsData.data?.forEach((metric: any) => {
          metric.values?.forEach((val: any) => {
            const dateStr = format(new Date(val.end_time), 'MMM dd')
            if (daysMap.has(dateStr)) {
              const dayData = daysMap.get(dateStr)!
              dayData[metric.name] = val.value || 0
            }
          })
        })

        setChartData(Array.from(daysMap.values()))

        // 3. Fetch Demographics
        const demoRes = await fetch(
          `https://graph.facebook.com/v25.0/${fbPageId}/insights?metric=page_follows_country,page_follows_city&access_token=${pageAccessToken}`,
          { signal }
        )
        if (!demoRes.ok) throw new Error('Failed to fetch demographics.')
        const demoData = await demoRes.json()

        const rawCountryData = demoData.data?.find((d: any) => d.name === 'page_follows_country')
        const rawCityData = demoData.data?.find((d: any) => d.name === 'page_follows_city')

        // Parse Demographics
        const parseDemo = (rawData: any) => {
          const map = rawData?.values?.[0]?.value || {}
          const parsed = Object.entries(map).map(([name, count]) => ({
            name,
            count: Number(count),
          }))
          const total = parsed.reduce((sum, item) => sum + item.count, 0)
          return parsed
            .sort((a, b) => b.count - a.count)
            .slice(0, 7)
            .map(item => ({
              ...item,
              percentage: total > 0 ? (item.count / total) * 100 : 0,
            }))
        }

        setDemographics({
          country: parseDemo(rawCountryData),
          city: parseDemo(rawCityData),
        })

      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('Error fetching Facebook Page insights:', err)
        setError(err.message || 'An error occurred while fetching insights.')
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      controller.abort()
    }
  }, [fbPageId, pageAccessToken, dateRange, retryCount])

  // Aggregate stats from chartData
  const aggregateStats = useMemo(() => {
    if (!chartData.length) return null
    return chartData.reduce((acc, curr) => ({
      reach: (acc.reach || 0) + (curr.page_total_media_view_unique || 0),
      engagements: (acc.engagements || 0) + (curr.page_post_engagements || 0),
      videoViews: (acc.videoViews || 0) + (curr.page_video_views || 0),
      profileViews: (acc.profileViews || 0) + (curr.page_views_total || 0),
      follows: (acc.follows || 0) + (curr.page_daily_follows_unique || 0),
      unfollows: (acc.unfollows || 0) + (curr.page_daily_unfollows_unique || 0),
    }), {} as Record<string, number>)
  }, [chartData])

  const getCountryName = (code: string) => {
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
      return displayNames.of(code.toUpperCase()) || code
    } catch {
      return code
    }
  }

  // Common chart components
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border shadow-md rounded-lg p-3 text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground capitalize">{entry.name.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-foreground ml-auto">{entry.value?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const dateRangeSelector = (
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-lg backdrop-blur-xl sm:flex-row">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Showing performance for:</span>
      </div>
      <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
        {[7, 14, 28, 90].map((days) => (
          <button
            key={days}
            onClick={() => setDateRange(days)}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-semibold transition-all',
              dateRange === days
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            {days} Days
          </button>
        ))}
      </div>
    </div>
  )

  const kpiCards = (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl transition-all duration-300 border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Audience</CardTitle>
          <Users className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-primary">
            {pageInfo?.followers_count?.toLocaleString() || '—'}
          </div>
          <p className="pt-1.5 text-xs text-muted-foreground flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {pageInfo?.fan_count?.toLocaleString()} likes
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Page Reach</CardTitle>
          <Activity className="h-5 w-5 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-foreground">
            {aggregateStats?.reach?.toLocaleString() || '0'}
          </div>
          <p className="pt-1.5 text-xs text-muted-foreground">Unique views in last {dateRange} days</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Engagements</CardTitle>
          <Heart className="h-5 w-5 text-pink-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-foreground">
            {aggregateStats?.engagements?.toLocaleString() || '0'}
          </div>
          <p className="pt-1.5 text-xs text-muted-foreground">Interactions in last {dateRange} days</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Video Views (3s+)</CardTitle>
          <Video className="h-5 w-5 text-indigo-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-foreground">
            {aggregateStats?.videoViews?.toLocaleString() || '0'}
          </div>
          <p className="pt-1.5 text-xs text-muted-foreground">Views in last {dateRange} days</p>
        </CardContent>
      </Card>
    </div>
  )

  const demographicsSection = (
    <Card className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-primary" /> Audience Demographics
        </CardTitle>
        <CardDescription>
          Breakdown of the locations where your audience resides
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground" /> Top Countries
            </h4>

            {!demographics?.country || demographics.country.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No country demographic data available.
              </div>
            ) : (
              <div className="space-y-3.5">
                {demographics.country.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground">{idx + 1}. {getCountryName(item.name)}</span>
                      <span className="text-foreground">{item.count.toLocaleString()} ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Top Cities
            </h4>

            {!demographics?.city || demographics.city.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No city demographic data available.
              </div>
            ) : (
              <div className="space-y-3.5">
                {demographics.city.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground">{idx + 1}. {item.name}</span>
                      <span className="text-foreground">{item.count.toLocaleString()} ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary/80"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (error) {
    return (
      <Alert variant="destructive" className="border-destructive/20 bg-destructive/10 text-destructive mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-bold">Error Loading Insights</AlertTitle>
        <AlertDescription className="mt-1 text-sm">
          {error}
          <div className="mt-4">
            <Button size="sm" variant="destructive" onClick={() => setRetryCount(c => c + 1)} className="gap-2">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 mt-2">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        kpiCards
      )}

      {!loading ? demographicsSection : <Skeleton className="h-64 w-full rounded-2xl" />}

      {dateRangeSelector}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[360px] w-full rounded-2xl" />)}
        </div>
      ) : chartsReady ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reach & Profile Views */}
          <Card className="col-span-1 rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Reach & Profile Views
              </CardTitle>
              <CardDescription>Daily unique reach and profile views</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Area yAxisId="left" type="monotone" name="Unique Reach" dataKey="page_total_media_view_unique" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorReach)" />
                    <Line yAxisId="right" type="monotone" name="Profile Views" dataKey="page_views_total" stroke="#10b981" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Followers Growth */}
          <Card className="col-span-1 rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Follower Growth
              </CardTitle>
              <CardDescription>
                Gained <strong className="text-emerald-500">+{aggregateStats?.follows}</strong> / 
                Lost <strong className="text-destructive">-{aggregateStats?.unfollows}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar name="New Follows" dataKey="page_daily_follows_unique" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar name="Unfollows" dataKey="page_daily_unfollows_unique" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Video Performance */}
          <Card className="col-span-1 rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" /> Video Performance
              </CardTitle>
              <CardDescription>3-second vs 30-second completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVideo1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorVideo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" name="3s Views" dataKey="page_video_views" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVideo1)" />
                    <Area type="monotone" name="30s Complete Views" dataKey="page_video_complete_views_30s" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorVideo2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Engagement & Reactions */}
          <Card className="col-span-1 rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Engagement & Reactions Breakdown
              </CardTitle>
              <CardDescription>Daily reaction distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar name="Likes" stackId="a" dataKey="page_actions_post_reactions_like_total" fill="#3b82f6" />
                    <Bar name="Loves" stackId="a" dataKey="page_actions_post_reactions_love_total" fill="#ec4899" />
                    <Bar name="Hahas" stackId="a" dataKey="page_actions_post_reactions_haha_total" fill="#eab308" />
                    <Bar name="Wows" stackId="a" dataKey="page_actions_post_reactions_wow_total" fill="#f97316" />
                    <Bar name="Sads" stackId="a" dataKey="page_actions_post_reactions_sorry_total" fill="#8b5cf6" />
                    <Bar name="Angers" stackId="a" dataKey="page_actions_post_reactions_anger_total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[360px] w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  )
}
