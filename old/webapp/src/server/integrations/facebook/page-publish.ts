import 'server-only'

import axios from 'axios'
import { graphUrl, FACEBOOK_GRAPH_VERSION } from '@/server/integrations/facebook/graph-client'
import { getFacebookPagesForAccount } from '@/server/services/facebook/pages-service'

export async function resolvePageAccessToken(params: {
  agencyId: string
  facebookAccountId: string
  fbPageId: string
}) {
  const pages = await getFacebookPagesForAccount(params.facebookAccountId, params.agencyId)
  const page = pages.find((p) => p.id === params.fbPageId)
  if (!page?.access_token) {
    throw new Error('Page not found or missing access token')
  }
  return { pageToken: page.access_token, pageName: page.name }
}

export async function publishFacebookFeedPost(params: {
  pageId: string
  pageToken: string
  message?: string
  fileUrl?: string
  mediaType: 'text' | 'image' | 'video'
  scheduledPublishTime?: number
}) {
  const accessToken = params.pageToken

  try {
    if (params.mediaType === 'text') {
    const body: Record<string, string | number | boolean> = {
      access_token: accessToken,
      message: params.message || '',
    }
    if (params.scheduledPublishTime) {
      body.published = false
      body.scheduled_publish_time = params.scheduledPublishTime
    }
    const res = await axios.post(graphUrl(`${params.pageId}/feed`), null, { params: body })
    return String(res.data.id || '')
  }

  if (params.mediaType === 'image') {
    if (!params.fileUrl) {
      throw new Error('Image posts require a file')
    }
    const body: Record<string, string | number | boolean> = {
      access_token: accessToken,
      url: params.fileUrl,
      caption: params.message || '',
    }
    if (params.scheduledPublishTime) {
      body.published = false
      body.scheduled_publish_time = params.scheduledPublishTime
    }
    const res = await axios.post(graphUrl(`${params.pageId}/photos`), null, { params: body })
    return String(res.data.post_id || res.data.id || '')
  }

  if (!params.fileUrl) {
    throw new Error('Video posts require a file')
  }

  const body: Record<string, string | number | boolean> = {
    access_token: accessToken,
    file_url: params.fileUrl,
    description: params.message || '',
  }
  if (params.scheduledPublishTime) {
    body.published = false
    body.scheduled_publish_time = params.scheduledPublishTime
  }
    const res = await axios.post(graphUrl(`${params.pageId}/videos`), null, { params: body })
    return String(res.data.id || '')
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message)
    }
    throw error
  }
}

export async function postFacebookFirstComment(params: {
  graphPostId: string
  pageToken: string
  message: string
}) {
  try {
    await axios.post(graphUrl(`${params.graphPostId}/comments`), null, {
      params: {
        access_token: params.pageToken,
        message: params.message,
      },
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message)
    }
    throw error
  }
}

export async function cancelFacebookScheduledPost(params: {
  graphPostId: string
  pageToken: string
}) {
  try {
    // Scheduled posts often cannot be deleted using the {page_id}_{post_id} format.
    // We should use just the post_id part if an underscore is present.
    const actualPostId = params.graphPostId.includes('_') 
      ? params.graphPostId.split('_')[1] || params.graphPostId
      : params.graphPostId

    await axios.delete(graphUrl(actualPostId), {
      params: { access_token: params.pageToken },
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
      // If it fails with the split ID, try with the full ID as a fallback just in case
      if (params.graphPostId.includes('_')) {
        try {
          await axios.delete(graphUrl(params.graphPostId), {
            params: { access_token: params.pageToken },
          })
          return // Success on fallback
        } catch {
          // Ignore fallback error and throw the original error
        }
      }
      throw new Error(error.response.data.error.message)
    }
    throw error
  }
}

export async function rescheduleFacebookPost(params: {
  graphPostId: string
  pageToken: string
  scheduledPublishTime: number
}) {
  try {
    const actualPostId = params.graphPostId.includes('_') 
      ? params.graphPostId.split('_')[1] || params.graphPostId
      : params.graphPostId

    await axios.post(graphUrl(actualPostId), null, {
      params: { 
        access_token: params.pageToken,
        scheduled_publish_time: params.scheduledPublishTime
      },
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
      if (params.graphPostId.includes('_')) {
        try {
          await axios.post(graphUrl(params.graphPostId), null, {
            params: { 
              access_token: params.pageToken,
              scheduled_publish_time: params.scheduledPublishTime
            },
          })
          return
        } catch {}
      }
      throw new Error(error.response.data.error.message)
    }
    throw error
  }
}

export { FACEBOOK_GRAPH_VERSION }
