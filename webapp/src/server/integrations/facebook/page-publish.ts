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
}

export async function postFacebookFirstComment(params: {
  graphPostId: string
  pageToken: string
  message: string
}) {
  await axios.post(graphUrl(`${params.graphPostId}/comments`), null, {
    params: {
      access_token: params.pageToken,
      message: params.message,
    },
  })
}

export async function cancelFacebookScheduledPost(params: {
  graphPostId: string
  pageToken: string
}) {
  await axios.delete(graphUrl(params.graphPostId), {
    params: { access_token: params.pageToken },
  })
}

export { FACEBOOK_GRAPH_VERSION }
