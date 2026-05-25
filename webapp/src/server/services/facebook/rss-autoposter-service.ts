import 'server-only'

import Parser from 'rss-parser'
import type { Database } from '@/types/database.types'
import { createClient } from '@/lib/supabase/server'
import { generateBalancedPostTimes } from '@/lib/scheduling'
import {
  buildUserMediaObjectKey,
  createPresignedDownloadUrl,
  putUserMediaObject,
} from '@/lib/r2/user-media'
import type { RssRenderVariables, RssTemplateDefinition } from '@/contracts/rss-autoposter'
import { mapParserItem } from '@/lib/rss-autoposter/feed'
import {
  deleteRssAutoposterPage,
  getRssAutoposterPage,
  getRssAutoposterStats,
  insertRssAutoposterPage,
  listRssAutoposterItems,
  listRssAutoposterPages,
  updateRssAutoposterPage,
} from '@/server/repositories/rss-autoposter-repository'
import { requireAgencyHasTokens } from '@/server/services/tokens/token-cost-service'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
    ],
  },
})

function resolvePostingTimes(input: {
  scheduleType: 'dailyrandom' | 'fixed' | 'randomfixed'
  postsPerDay: number
  postingTimes: string[]
}) {
  if (input.scheduleType === 'fixed') return input.postingTimes
  return generateBalancedPostTimes(input.postsPerDay)
}

export async function listRssPages(agencyId: string) {
  return listRssAutoposterPages(agencyId)
}

export async function getRssPage(agencyId: string, pageId: string) {
  return getRssAutoposterPage(agencyId, pageId)
}

export async function getRssAgencyStats(agencyId: string) {
  return getRssAutoposterStats(agencyId)
}

export async function fetchAndValidateRssFeed(rssFeedUrl: string) {
  const feed = await parser.parseURL(rssFeedUrl)
  const items = (feed.items || []).slice(0, 20).map((item) =>
    mapParserItem(item as unknown as Record<string, unknown>)
  )
  const latest = items[0]
  if (!latest) {
    throw new Error('RSS feed has no items')
  }
  return { feedTitle: feed.title || '', items, latest }
}

export async function createRssAutoposterPage(
  agencyId: string,
  input: {
    facebookAccountId: string
    fbPageId: string
    fbPageName: string
    fbPageAccessToken: string
    fbPageImage?: string
    rssFeedUrl: string
    timezone: string
    postsPerDay: number
    scheduleType: 'dailyrandom' | 'fixed' | 'randomfixed'
    postingTimes: string[]
    templateDefinition: RssTemplateDefinition
    templatePresetKey?: string
    canvasAspectRatio: '4:5' | '1:1' | '16:9'
    brandLogoObjectKey?: string
    brandSiteUrl?: string
    firstComment?: string
  }
) {
  await requireAgencyHasTokens(agencyId)
  await fetchAndValidateRssFeed(input.rssFeedUrl)

  const postingTimes = resolvePostingTimes({
    scheduleType: input.scheduleType,
    postsPerDay: input.postsPerDay,
    postingTimes: input.postingTimes,
  })

  return insertRssAutoposterPage({
    agency_id: agencyId,
    facebook_account_id: input.facebookAccountId,
    fb_page_id: input.fbPageId,
    fb_page_name: input.fbPageName,
    fb_page_image: input.fbPageImage ?? null,
    fb_page_access_token: input.fbPageAccessToken,
    rss_feed_url: input.rssFeedUrl,
    timezone: input.timezone,
    posts_per_day: input.postsPerDay,
    schedule_type: input.scheduleType,
    posting_times: postingTimes as unknown as Database['public']['Tables']['facebook_rss_autoposter_pages']['Insert']['posting_times'],
    template_definition: input.templateDefinition as unknown as Database['public']['Tables']['facebook_rss_autoposter_pages']['Insert']['template_definition'],
    template_preset_key: input.templatePresetKey ?? null,
    canvas_aspect_ratio: input.canvasAspectRatio,
    brand_logo_object_key: input.brandLogoObjectKey ?? null,
    brand_site_url: input.brandSiteUrl ?? null,
    first_comment: input.firstComment ?? null,
    status: 'active',
  })
}

export async function updateRssAutoposterPageSettings(
  agencyId: string,
  pageId: string,
  patch: {
    rssFeedUrl?: string
    timezone?: string
    postsPerDay?: number
    scheduleType?: 'dailyrandom' | 'fixed' | 'randomfixed'
    postingTimes?: string[]
    templateDefinition?: RssTemplateDefinition
    templatePresetKey?: string
    canvasAspectRatio?: '4:5' | '1:1' | '16:9'
    brandLogoObjectKey?: string | null
    brandSiteUrl?: string | null
    firstComment?: string | null
    status?: 'active' | 'paused'
  }
) {
  const existing = await getRssAutoposterPage(agencyId, pageId)
  if (!existing) throw new Error('Page not found')

  const row: Record<string, unknown> = {}
  if (patch.rssFeedUrl) {
    await fetchAndValidateRssFeed(patch.rssFeedUrl)
    row.rss_feed_url = patch.rssFeedUrl
  }
  if (patch.timezone) row.timezone = patch.timezone
  if (patch.templateDefinition) row.template_definition = patch.templateDefinition
  if (patch.templatePresetKey !== undefined) row.template_preset_key = patch.templatePresetKey
  if (patch.canvasAspectRatio) row.canvas_aspect_ratio = patch.canvasAspectRatio
  if (patch.brandLogoObjectKey !== undefined) row.brand_logo_object_key = patch.brandLogoObjectKey
  if (patch.brandSiteUrl !== undefined) row.brand_site_url = patch.brandSiteUrl
  if (patch.firstComment !== undefined) row.first_comment = patch.firstComment
  if (patch.status) row.status = patch.status

  if (patch.postsPerDay !== undefined || patch.scheduleType || patch.postingTimes) {
    const postsPerDay = patch.postsPerDay ?? existing.posts_per_day
    const scheduleType =
      patch.scheduleType ?? (existing.schedule_type as 'dailyrandom' | 'fixed' | 'randomfixed')
    const postingTimes = resolvePostingTimes({
      scheduleType,
      postsPerDay,
      postingTimes: patch.postingTimes ?? (existing.posting_times as string[]) ?? [],
    })
    row.posts_per_day = postsPerDay
    row.schedule_type = scheduleType
    row.posting_times = postingTimes
  }

  return updateRssAutoposterPage(agencyId, pageId, row)
}

export async function removeRssAutoposterPage(agencyId: string, pageId: string) {
  return deleteRssAutoposterPage(agencyId, pageId)
}

export async function listRssPageItems(
  agencyId: string,
  pageId: string,
  view: 'history' | 'recent' = 'history'
) {
  const statuses =
    view === 'history'
      ? ['published', 'failed', 'skipped', 'rendering', 'pending_publish']
      : undefined
  return listRssAutoposterItems(agencyId, pageId, { statuses, limit: 100 })
}

async function renderRssTemplatePng(
  templateDefinition: RssTemplateDefinition,
  variables: RssRenderVariables
) {
  const { renderRssTemplate } = await import('@/server/lib/rss-template-renderer/render')
  return renderRssTemplate(templateDefinition, variables)
}

export async function renderTemplatePreview(params: {
  agencyId: string
  templateDefinition: RssTemplateDefinition
  variables: RssRenderVariables
}): Promise<{ pngBase64: string; objectKey?: string }> {
  const png = await renderRssTemplatePng(params.templateDefinition, params.variables)
  return { pngBase64: png.toString('base64') }
}

export async function renderAndUploadForWorker(params: {
  agencyId: string
  templateDefinition: RssTemplateDefinition
  variables: RssRenderVariables
}): Promise<{ objectKey: string }> {
  const png = await renderRssTemplatePng(params.templateDefinition, params.variables)
  const objectKey = buildUserMediaObjectKey('rss-autoposter', params.agencyId, 'render.png')
  await putUserMediaObject({
    objectKey,
    body: png,
    contentType: 'image/png',
  })
  return { objectKey }
}

export async function resolveBrandLogoUrl(agencyId: string, objectKey?: string | null) {
  if (!objectKey) return undefined
  try {
    return await createPresignedDownloadUrl(objectKey)
  } catch {
    return undefined
  }
}

export async function pauseRssPagesForInvalidAccount(facebookAccountId: string) {
  const supabase = await createClient()
  await supabase
    .from('facebook_rss_autoposter_pages')
    .update({
      status: 'paused',
      last_fetch_error: 'Facebook account token invalid — reconnect required',
      updated_at: new Date().toISOString(),
    })
    .eq('facebook_account_id', facebookAccountId)
    .eq('status', 'active')
}

export async function refreshRssPageTokens(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facebookAccountId: string,
  agencyId: string,
  pageTokens: { fb_page_id: string; access_token: string }[]
) {
  for (const pt of pageTokens) {
    await supabase
      .from('facebook_rss_autoposter_pages')
      .update({
        fb_page_access_token: pt.access_token,
        updated_at: new Date().toISOString(),
      })
      .eq('facebook_account_id', facebookAccountId)
      .eq('agency_id', agencyId)
      .eq('fb_page_id', pt.fb_page_id)
  }
}
