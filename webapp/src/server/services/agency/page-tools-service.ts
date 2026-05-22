import { createClient } from '@/lib/supabase/server'
import { graphDelete, graphGet } from '@/server/integrations/facebook/graph-client'

export type PageToolsContentType = 'posts' | 'photos' | 'reels'
export type PageToolsSort = 'oldest_first' | 'newest_first'
const MAX_DELETE_CANDIDATES = 500
const MAX_BATCH_DELETE_SIZE = 25

type GraphCursor = {
  before?: string
  after?: string
}

type PageToolsContentItem = {
  id: string
  type: PageToolsContentType
  title: string
  created_time: string | null
  permalink_url: string | null
  preview_image_url: string | null
}

type GraphPost = {
  id: string
  message?: string
  created_time?: string
  permalink_url?: string
  full_picture?: string
}

type GraphPhoto = {
  id: string
  name?: string
  created_time?: string
  permalink_url?: string
  images?: Array<{ source?: string }>
}

type GraphVideo = {
  id: string
  title?: string
  description?: string
  created_time?: string
  permalink_url?: string
  thumbnails?: { data?: Array<{ uri?: string }> }
}

type GraphPageResponse<T> = {
  data: T[]
  paging?: {
    cursors?: GraphCursor
    next?: string
    previous?: string
  }
}

function normalizeFacebookPermalink(url?: string | null) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `https://www.facebook.com${url}`
  return `https://www.facebook.com/${url}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const maybeResponse = error as Error & {
      response?: { data?: { error?: { message?: string } } }
    }
    return maybeResponse.response?.data?.error?.message || error.message || fallback
  }
  return fallback
}

async function getAgencyAccountToken(accountId: string, agencyId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_accounts')
    .select('fb_user_access_token')
    .eq('id', accountId)
    .eq('agency_id', agencyId)
    .single()
  if (error || !data?.fb_user_access_token) {
    throw new Error('Facebook account not found for this agency')
  }
  return data.fb_user_access_token
}

function mapPosts(items: GraphPost[]): PageToolsContentItem[] {
  return items.map((item) => ({
    id: item.id,
    type: 'posts',
    title: (item.message || '').trim() || 'Untitled post',
    created_time: item.created_time || null,
    permalink_url: normalizeFacebookPermalink(item.permalink_url),
    preview_image_url: item.full_picture || null,
  }))
}

function mapPhotos(items: GraphPhoto[]): PageToolsContentItem[] {
  return items.map((item) => ({
    id: item.id,
    type: 'photos',
    title: (item.name || '').trim() || 'Untitled photo',
    created_time: item.created_time || null,
    permalink_url: normalizeFacebookPermalink(item.permalink_url),
    preview_image_url: item.images?.[0]?.source || null,
  }))
}

function mapVideos(items: GraphVideo[]): PageToolsContentItem[] {
  return items.map((item) => ({
    id: item.id,
    type: 'reels',
    title: (item.title || item.description || '').trim() || 'Untitled reel',
    created_time: item.created_time || null,
    permalink_url: normalizeFacebookPermalink(item.permalink_url),
    preview_image_url: item.thumbnails?.data?.[0]?.uri || null,
  }))
}

async function fetchReelsPage(accessToken: string, pageId: string, limit: number, after?: string) {
  try {
    return await graphGet<GraphPageResponse<GraphVideo>>(`${pageId}/video_reels`, {
      access_token: accessToken,
      fields: 'id,title,description,created_time,permalink_url,thumbnails',
      limit,
      ...(after ? { after } : {}),
    })
  } catch {
    return graphGet<GraphPageResponse<GraphVideo>>(`${pageId}/videos`, {
      access_token: accessToken,
      fields: 'id,title,description,created_time,permalink_url,thumbnails',
      limit,
      ...(after ? { after } : {}),
    })
  }
}

type ListParams = {
  accountId: string
  agencyId: string
  pageId: string
  type: PageToolsContentType
  limit: number
  after?: string
  dateFrom?: string
  dateTo?: string
  pageAccessToken?: string
}

async function listFacebookContentPage(params: ListParams) {
  const accessToken = params.pageAccessToken || (await getAgencyAccountToken(params.accountId, params.agencyId))
  const common = {
    access_token: accessToken,
    limit: params.limit,
    ...(params.after ? { after: params.after } : {}),
    ...(params.dateFrom ? { since: params.dateFrom } : {}),
    ...(params.dateTo ? { until: params.dateTo } : {}),
  }

  if (params.type === 'posts') {
    const response = await graphGet<GraphPageResponse<GraphPost>>(`${params.pageId}/posts`, {
      ...common,
      fields: 'id,message,created_time,permalink_url,full_picture',
    })
    return { items: mapPosts(response.data.data || []), paging: response.data.paging || null }
  }
  if (params.type === 'photos') {
    const response = await graphGet<GraphPageResponse<GraphPhoto>>(`${params.pageId}/photos`, {
      ...common,
      fields: 'id,name,created_time,permalink_url,images',
    })
    return { items: mapPhotos(response.data.data || []), paging: response.data.paging || null }
  }
  const response = await fetchReelsPage(accessToken, params.pageId, params.limit, params.after)
  return { items: mapVideos(response.data.data || []), paging: response.data.paging || null }
}

export async function listPageToolsContent(params: {
  agencyId: string
  accountId: string
  pageId: string
  type: PageToolsContentType
  limit?: number
  after?: string
  dateFrom?: string
  dateTo?: string
  pageAccessToken?: string
}) {
  const limit = Math.min(Math.max(params.limit || 25, 1), 100)
  try {
    return await listFacebookContentPage({
      accountId: params.accountId,
      agencyId: params.agencyId,
      pageId: params.pageId,
      type: params.type,
      limit,
      after: params.after,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      pageAccessToken: params.pageAccessToken,
    })
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to fetch page content from Facebook'))
  }
}

export async function resolveDeleteCandidates(params: {
  agencyId: string
  accountId: string
  pageId: string
  type: PageToolsContentType
  dateFrom?: string
  dateTo?: string
  sort: PageToolsSort
  maxCandidates?: number
  pageAccessToken?: string
}) {
  const cap = Math.min(Math.max(params.maxCandidates || MAX_DELETE_CANDIDATES, 1), MAX_DELETE_CANDIDATES)
  const collected: PageToolsContentItem[] = []
  let after: string | undefined
  while (collected.length < cap) {
    const page = await listPageToolsContent({
      agencyId: params.agencyId,
      accountId: params.accountId,
      pageId: params.pageId,
      type: params.type,
      limit: 100,
      after,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      pageAccessToken: params.pageAccessToken,
    })
    const items = page.items || []
    if (!items.length) break
    collected.push(...items)
    after = page.paging?.cursors?.after
    if (!after) break
  }

  const filtered = collected.filter((item) => {
    if (!item.created_time) return true
    const createdAt = Date.parse(item.created_time)
    if (Number.isNaN(createdAt)) return true
    if (params.dateFrom) {
      const from = Date.parse(params.dateFrom)
      if (!Number.isNaN(from) && createdAt < from) return false
    }
    if (params.dateTo) {
      const to = Date.parse(params.dateTo)
      if (!Number.isNaN(to) && createdAt > to) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a.created_time ? Date.parse(a.created_time) : 0
    const bv = b.created_time ? Date.parse(b.created_time) : 0
    return params.sort === 'oldest_first' ? av - bv : bv - av
  })

  return {
    total: sorted.length,
    candidates: sorted.slice(0, cap),
  }
}

export async function bulkDeletePageToolsContent(params: {
  agencyId: string
  accountId: string
  pageAccessToken?: string
  contentIds: string[]
}) {
  const accessToken = params.pageAccessToken || (await getAgencyAccountToken(params.accountId, params.agencyId))
  const batch = params.contentIds.slice(0, MAX_BATCH_DELETE_SIZE)
  const results: Array<{ id: string; success: boolean; error?: string }> = []
  for (const id of batch) {
    try {
      await graphDelete(id, { access_token: accessToken })
      results.push({ id, success: true })
    } catch (error) {
      results.push({ id, success: false, error: getErrorMessage(error, 'Delete failed') })
    }
  }
  const succeeded = results.filter((item) => item.success).length
  const failed = results.length - succeeded
  return {
    total: batch.length,
    succeeded,
    failed,
    results,
  }
}

