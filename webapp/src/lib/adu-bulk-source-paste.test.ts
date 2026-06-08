import { describe, it, expect } from 'vitest'
import {
  assignBulkSourcesRandomly,
  buildBulkSourcePastePreview,
  canApplyBulkSourcePastePreview,
  parseBulkSourcePasteLines,
  resolveBulkSourcePlatformAlias,
} from './adu-bulk-source-paste'

const pages = [
  { key: 'a:1', pageName: 'Page A' },
  { key: 'a:2', pageName: 'Page B' },
  { key: 'a:3', pageName: 'Page C' },
]

describe('resolveBulkSourcePlatformAlias', () => {
  it('resolves short aliases', () => {
    expect(resolveBulkSourcePlatformAlias('ig')).toBe('instagram')
    expect(resolveBulkSourcePlatformAlias('fb')).toBe('facebook')
  })
})

describe('parseBulkSourcePasteLines', () => {
  it('parses pipe, comma, and colon formats', () => {
    const pipe = parseBulkSourcePasteLines('instagram|ronaldo', 'instagram')
    const comma = parseBulkSourcePasteLines('youtube,channel123', 'instagram')
    const colon = parseBulkSourcePasteLines('tiktok:creator', 'instagram')

    expect(pipe.sources).toHaveLength(1)
    expect(pipe.sources[0]?.platform).toBe('instagram')
    expect(pipe.sources[0]?.username).toBe('ronaldo')

    expect(comma.sources[0]?.platform).toBe('youtube')
    expect(comma.sources[0]?.username).toBe('channel123')

    expect(colon.sources[0]?.platform).toBe('tiktok')
    expect(colon.sources[0]?.username).toBe('creator')
  })

  it('strips @ and skips blank or comment lines', () => {
    const result = parseBulkSourcePasteLines(
      '# comment\n\ninstagram|@messi\n',
      'instagram',
    )
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]?.username).toBe('messi')
  })

  it('uses default platform for username-only lines', () => {
    const result = parseBulkSourcePasteLines('ronaldo', 'facebook')
    expect(result.sources[0]?.platform).toBe('facebook')
    expect(result.sources[0]?.username).toBe('ronaldo')
  })

  it('reports invalid platform and empty username', () => {
    const result = parseBulkSourcePasteLines('snap|user\ninstagram|', 'instagram')
    expect(result.sources).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
  })

  it('dedupes duplicate lines with warning', () => {
    const result = parseBulkSourcePasteLines(
      'instagram|ronaldo\ninstagram|ronaldo\ninstagram|messi',
      'instagram',
    )
    expect(result.sources).toHaveLength(2)
    expect(result.warnings.some((w) => w.includes('duplicates line 1'))).toBe(true)
  })

  it('blocks when line count exceeds max', () => {
    const lines = Array.from({ length: 1001 }, (_, i) => `instagram|user${i}`).join('\n')
    const result = parseBulkSourcePasteLines(lines, 'instagram')
    expect(result.errors[0]?.message).toContain('Maximum 1000')
  })
})

describe('assignBulkSourcesRandomly', () => {
  it('assigns each source to a unique page', () => {
    const sources = parseBulkSourcePasteLines(
      'instagram|a\nyoutube|b',
      'instagram',
    ).sources
    const result = assignBulkSourcesRandomly(sources, pages, () => 0)

    expect(result.assignments).toHaveLength(2)
    expect(new Set(result.assignments.map((row) => row.pageKey)).size).toBe(2)
    expect(result.unassignedPageKeys).toHaveLength(1)
  })

  it('leaves extra pages unassigned when sources are fewer', () => {
    const sources = parseBulkSourcePasteLines('instagram|only', 'instagram').sources
    const result = assignBulkSourcesRandomly(sources, pages, () => 0.5)

    expect(result.assignments).toHaveLength(1)
    expect(result.unassignedPageKeys).toHaveLength(2)
  })
})

describe('buildBulkSourcePastePreview', () => {
  it('returns overflow error when sources exceed empty page slots', () => {
    const preview = buildBulkSourcePastePreview(
      'instagram|a\ninstagram|b\ninstagram|c\ninstagram|d',
      pages.slice(0, 2),
      'instagram',
    )
    expect(preview.overflowError).toContain('Remove 2 line(s)')
    expect(canApplyBulkSourcePastePreview(preview)).toBe(false)
  })

  it('assigns only to empty pages when some pages already have sources', () => {
    const preview = buildBulkSourcePastePreview(
      'instagram|new1\ninstagram|new2',
      pages,
      'instagram',
      {
        'a:1': { sourcePlatform: 'facebook', sourceUsername: 'filled' },
      },
      () => 0,
    )
    expect(preview.assignments).toHaveLength(2)
    expect(preview.assignments.every((row) => row.pageKey !== 'a:1')).toBe(true)
    expect(canApplyBulkSourcePastePreview(preview)).toBe(true)
  })

  it('ignores pasted sources that already exist on a selected page', () => {
    const preview = buildBulkSourcePastePreview(
      'instagram|ronaldo\ninstagram|messi',
      pages.slice(0, 2),
      'instagram',
      {
        'a:1': { sourcePlatform: 'instagram', sourceUsername: 'ronaldo' },
      },
      () => 0,
    )
    expect(preview.sources).toHaveLength(1)
    expect(preview.sources[0]?.username).toBe('messi')
    expect(preview.warnings.some((w) => w.includes('already on Page A'))).toBe(true)
    expect(preview.assignments).toHaveLength(1)
    expect(preview.assignments[0]?.pageKey).toBe('a:2')
  })

  it('blocks overflow against empty slots not total selected pages', () => {
    const preview = buildBulkSourcePastePreview(
      'instagram|a\ninstagram|b\ninstagram|c',
      pages,
      'instagram',
      {
        'a:1': { sourcePlatform: 'facebook', sourceUsername: 'filled' },
      },
    )
    expect(preview.overflowError).toContain('only 2 empty page slots')
    expect(canApplyBulkSourcePastePreview(preview)).toBe(false)
  })

  it('builds assignments when counts are valid', () => {
    const preview = buildBulkSourcePastePreview(
      'instagram|a\nfacebook|b',
      pages,
      'instagram',
      {},
      () => 0,
    )
    expect(preview.overflowError).toBeNull()
    expect(preview.assignments).toHaveLength(2)
    expect(canApplyBulkSourcePastePreview(preview)).toBe(true)
  })
})
