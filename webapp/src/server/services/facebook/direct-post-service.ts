import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createPresignedDownloadUrl, deleteUserMediaObject } from '@/lib/r2/user-media'
import {
  postFacebookFirstComment,
  publishFacebookFeedPost,
  resolvePageAccessToken,
} from '@/server/integrations/facebook/page-publish'
import {
  deductAgencyTokens,
  getTokenCostForFeature,
  requireAgencyHasTokens,
} from '@/server/services/tokens/token-cost-service'

export type DirectPostInput = {
  facebookAccountId: string
  fbPageId: string
  mediaType: 'text' | 'image' | 'video'
  caption?: string
  firstComment?: string
  mediaObjectKey?: string
}

export async function publishDirectPost(agencyId: string, input: DirectPostInput) {
  await requireAgencyHasTokens(agencyId)

  if (input.mediaType !== 'text' && !input.mediaObjectKey) {
    throw new Error('Media file is required for image and video posts')
  }

  const { pageToken, pageName } = await resolvePageAccessToken({
    agencyId,
    facebookAccountId: input.facebookAccountId,
    fbPageId: input.fbPageId,
  })

  let fileUrl: string | undefined
  if (input.mediaObjectKey) {
    fileUrl = await createPresignedDownloadUrl(input.mediaObjectKey)
  }

  let graphPostId: string | null = null
  let status: 'published' | 'failed' = 'published'
  let errorMessage: string | null = null
  let tokensCharged = 0

  try {
    graphPostId = await publishFacebookFeedPost({
      pageId: input.fbPageId,
      pageToken,
      message: input.caption,
      fileUrl,
      mediaType: input.mediaType,
    })

    if (input.firstComment?.trim() && graphPostId) {
      await postFacebookFirstComment({
        graphPostId,
        pageToken,
        message: input.firstComment.trim(),
      })
    }

    tokensCharged = await getTokenCostForFeature({
      feature: 'direct_post',
      mediaType: input.mediaType,
    })
    await deductAgencyTokens(agencyId, tokensCharged)

    if (input.mediaObjectKey) {
      await deleteUserMediaObject(input.mediaObjectKey)
    }
  } catch (error) {
    status = 'failed'
    errorMessage = error instanceof Error ? error.message : 'Publish failed'
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_posts')
    .insert({
      agency_id: agencyId,
      facebook_account_id: input.facebookAccountId,
      fb_page_id: input.fbPageId,
      fb_page_name: pageName,
      media_type: input.mediaType,
      caption: input.caption ?? null,
      first_comment: input.firstComment ?? null,
      graph_post_id: graphPostId,
      status,
      error_message: errorMessage,
      tokens_charged: tokensCharged,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (status === 'failed') {
    throw new Error(errorMessage || 'Publish failed')
  }

  return data
}

export async function listDirectPostHistory(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_posts')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
