import { Tables } from './database.types'

/**
 * Facebook Account with related data
 */
export type FacebookAccount = Tables<'facebook_accounts'> & {
  fb_user_image?: string | null
  created_at?: string | null
  fb_app_id?: string | null
}

export type FacebookAccountPageStats = {
  linkedPagesCount: number
  invalidTokenPagesCount: number
}

/**
 * Facebook Page from Graph API
 */
export type FacebookGraphPage = {
  id: string
  name: string
  access_token: string
  picture?: string
  followers_count?: number
}

/**
 * Page with related data including Facebook account and reels
 */

/**
 * Page with reels for client component
 */
export type PageWithReels = Partial<Tables<'pages'>> &
  Pick<Tables<'pages'>, 'id' | 'page_name' | 'fb_page_id' | 'source_username' | 'status' | 'sync_status'> & {
    facebook_accounts?: {
      fb_user_name: string | null
      fb_user_image: string | null
    } | null
    posted_today?: number
    failed_today?: number
  }

/**
 * Agency Settings
 */
export type AgencySettings = {
  fb_app_id?: string | null
  fb_app_secret?: string | null
  fb_app_name?: string | null
  subdomain?: string | null
}

/**
 * Page Settings Form Data
 */

/**
 * API Response wrapper
 */

/**
 * Facebook API Response for pages
 */

/**
 * Facebook API Response for businesses
 */
export type FacebookBusiness = {
  id: string
  name: string
}

/**
 * User settings from database
 */
export type UserSettings = {
  fb_app_id?: string | null
  fb_app_secret?: string | null
  subdomain?: string | null
}

export type BulkPageInput = {
  facebookAccountId?: string
  pageName: string
  fbPageId: string
  fbPageAccessToken: string
  fbPageImage?: string
  followersCount?: number
  sourceUsername: string
  sourcePlatform: 'instagram' | 'youtube' | 'tiktok' | 'facebook'
  postsPerDay: number
  timezone: string
  scheduleType: 'dailyrandom' | 'fixed'
  postingTimes?: string[]
}

export type MultiAccountBulkPageInput = Omit<BulkPageInput, 'facebookAccountId'> & {
  facebookAccountId: string
}

export type BulkPageFailure = {
  pageName: string
  reason: string
}

export type BulkCreateResult = {
  success: boolean
  created: Array<{ pageName: string }>
  failed: BulkPageFailure[]
}
