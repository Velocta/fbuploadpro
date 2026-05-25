'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, History } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

export function InappPageDetailTabs({
  queue,
  history,
}: {
  queue: React.ReactNode
  history: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'queue'

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={currentTab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-6 w-full max-w-sm grid grid-cols-2 p-1 bg-muted/30">
        <TabsTrigger value="queue" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
          <Clock className="h-4 w-4" />
          Queue
        </TabsTrigger>
        <TabsTrigger value="history" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
          <History className="h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>

      <div className="relative">
        <TabsContent value="queue" className="mt-0 outline-none">
          {queue}
        </TabsContent>
        <TabsContent value="history" className="mt-0 outline-none">
          {history}
        </TabsContent>
      </div>
    </Tabs>
  )
}
