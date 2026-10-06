import { describe, expect, it } from 'vitest'
import {
  TOKEN_LOW_THRESHOLD,
  aggregateOverviewStats,
  deriveAttentionSectionTitle,
  deriveTokenBalanceTier,
  hasFacebookByocConfigured,
  tokenBalanceKpiSubcopy,
} from './dashboard-overview-utils'

describe('deriveTokenBalanceTier', () => {
  it('classifies zero, low, and ok', () => {
    expect(deriveTokenBalanceTier(0)).toBe('zero')
    expect(deriveTokenBalanceTier(1)).toBe('low')
    expect(deriveTokenBalanceTier(TOKEN_LOW_THRESHOLD - 1)).toBe('low')
    expect(deriveTokenBalanceTier(TOKEN_LOW_THRESHOLD)).toBe('ok')
  })
})

describe('tokenBalanceKpiSubcopy', () => {
  it('reflects tier messaging', () => {
    expect(tokenBalanceKpiSubcopy(0)).toContain('Add tokens')
    expect(tokenBalanceKpiSubcopy(500)).toContain('1,000')
    expect(tokenBalanceKpiSubcopy(2000)).toContain('automation')
  })
})

describe('aggregateOverviewStats', () => {
  it('computes total followers gained', () => {
    const stats = aggregateOverviewStats([
      {
        id: '1',
        page_name: 'A',
        fb_page_image: null,
        status: 'active',
        sync_status: null,
        pending_reels_count: 2,
        posted_reels_count: 1,
        failed_reels_count: 1,
        followers_count: 10,
        followers_gained: 15,
      },
    ])
    expect(stats.totalFollowersGained).toBe(5)
  })
})

describe('deriveAttentionSectionTitle', () => {
  it('shows needs attention count', () => {
    expect(deriveAttentionSectionTitle(2, 1).title).toBe('Needs attention (3)')
    expect(deriveAttentionSectionTitle(0, 0).title).toBe('All systems go')
  })
})

describe('hasFacebookByocConfigured', () => {
  it('requires both app id and secret', () => {
    expect(hasFacebookByocConfigured({ fb_app_id: 'x', fb_app_secret: 'y' })).toBe(true)
    expect(hasFacebookByocConfigured({ fb_app_id: '  ', fb_app_secret: 'y' })).toBe(false)
    expect(hasFacebookByocConfigured(null)).toBe(false)
  })
})
