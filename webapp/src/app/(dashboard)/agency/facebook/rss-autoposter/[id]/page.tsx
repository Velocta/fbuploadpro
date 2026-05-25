import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RssPageDetailClient } from '@/features/rss-autoposter/ui/page-detail-client'
import { getRssPage, listRssPageItems } from '@/server/services/facebook/rss-autoposter-service'

type Props = { params: Promise<{ id: string }> }

export default async function RssAutoposterDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = await getRssPage(user.id, id)
  if (!page) notFound()

  const items = await listRssPageItems(user.id, id, 'history')

  const postingTimes = Array.isArray(page.posting_times)
    ? (page.posting_times as string[])
    : []

  const clientPage = {
    ...page,
    posting_times: postingTimes,
    template_definition: page.template_definition as import('@/contracts/rss-autoposter').RssTemplateDefinition,
    canvas_aspect_ratio: (page.canvas_aspect_ratio || '4:5') as import('@/contracts/rss-autoposter').CanvasAspectRatio,
    schedule_type: String(page.schedule_type),
    facebook_accounts: Array.isArray(page.facebook_accounts)
      ? page.facebook_accounts[0] ?? null
      : page.facebook_accounts,
  }

  return <RssPageDetailClient page={clientPage} initialItems={items} />
}
