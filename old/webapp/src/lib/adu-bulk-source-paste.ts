import { sanitizeSourceIdentityInput, type SourcePlatform } from '@/lib/source-identity'

export const ADU_BULK_SOURCE_PASTE_MAX_LINES = 1000

export type ParsedBulkSource = {
  lineNumber: number
  platform: SourcePlatform
  username: string
  dedupeKey: string
}

export type BulkSourcePasteParseError = {
  lineNumber: number
  message: string
}

export type BulkSourcePastePageTarget = {
  key: string
  pageName: string
}

export type BulkSourcePasteExistingAssignment = {
  sourcePlatform: SourcePlatform
  sourceUsername: string
}

export type BulkSourcePasteAssignmentPreview = {
  pageKey: string
  pageName: string
  platform: SourcePlatform
  username: string
}

export type BulkSourcePastePreview = {
  sources: ParsedBulkSource[]
  errors: BulkSourcePasteParseError[]
  warnings: string[]
  overflowError: string | null
  assignments: BulkSourcePasteAssignmentPreview[]
  unassignedPageKeys: string[]
  assignmentByPageKey: Record<string, { sourcePlatform: SourcePlatform; sourceUsername: string }>
}

const PLATFORM_ALIAS: Record<string, SourcePlatform> = {
  instagram: 'instagram',
  ig: 'instagram',
  insta: 'instagram',
  youtube: 'youtube',
  yt: 'youtube',
  tiktok: 'tiktok',
  tt: 'tiktok',
  facebook: 'facebook',
  fb: 'facebook',
}

export function resolveBulkSourcePlatformAlias(value: string): SourcePlatform | null {
  const normalized = value.trim().toLowerCase()
  return PLATFORM_ALIAS[normalized] ?? null
}

function splitPasteLine(rawLine: string): { platformPart: string; usernamePart: string } | null {
  const trimmed = rawLine.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  for (const delimiter of ['|', ',', ':'] as const) {
    const index = trimmed.indexOf(delimiter)
    if (index > 0) {
      return {
        platformPart: trimmed.slice(0, index).trim(),
        usernamePart: trimmed.slice(index + 1).trim(),
      }
    }
  }

  return { platformPart: '', usernamePart: trimmed }
}

export function buildBulkSourceDedupeKey(platform: SourcePlatform, username: string): string {
  return `${platform}:${username.toLowerCase()}`
}

function pageHasSource(existing: BulkSourcePasteExistingAssignment | undefined): boolean {
  return Boolean(existing?.sourceUsername?.trim())
}

function filterSourcesNotAlreadyOnPages(
  sources: ParsedBulkSource[],
  pages: BulkSourcePastePageTarget[],
  existingByPageKey: Record<string, BulkSourcePasteExistingAssignment | undefined>,
): { sources: ParsedBulkSource[]; warnings: string[] } {
  const existingKeys = new Map<string, string>()
  for (const page of pages) {
    const existing = existingByPageKey[page.key]
    if (!pageHasSource(existing)) continue
    const key = buildBulkSourceDedupeKey(
      existing!.sourcePlatform,
      sanitizeSourceIdentityInput(existing!.sourcePlatform, existing!.sourceUsername),
    )
    existingKeys.set(key, page.pageName)
  }

  const warnings: string[] = []
  const next: ParsedBulkSource[] = []
  for (const source of sources) {
    const pageName = existingKeys.get(source.dedupeKey)
    if (pageName !== undefined) {
      warnings.push(
        `Line ${source.lineNumber} (${source.platform}|${source.username}) already on ${pageName} — ignored.`,
      )
      continue
    }
    next.push(source)
  }
  return { sources: next, warnings }
}

function emptyPagesForPaste(
  pages: BulkSourcePastePageTarget[],
  existingByPageKey: Record<string, BulkSourcePasteExistingAssignment | undefined>,
): BulkSourcePastePageTarget[] {
  return pages.filter((page) => !pageHasSource(existingByPageKey[page.key]))
}

export function parseBulkSourcePasteLines(
  text: string,
  defaultPlatform: SourcePlatform,
): { sources: ParsedBulkSource[]; errors: BulkSourcePasteParseError[]; warnings: string[] } {
  const lines = text.split(/\r?\n/)
  if (lines.length > ADU_BULK_SOURCE_PASTE_MAX_LINES) {
    return {
      sources: [],
      errors: [{
        lineNumber: ADU_BULK_SOURCE_PASTE_MAX_LINES + 1,
        message: `Maximum ${ADU_BULK_SOURCE_PASTE_MAX_LINES} lines are supported.`,
      }],
      warnings: [],
    }
  }

  const sources: ParsedBulkSource[] = []
  const errors: BulkSourcePasteParseError[] = []
  const warnings: string[] = []
  const seenKeys = new Map<string, number>()

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const split = splitPasteLine(lines[i] ?? '')
    if (!split) continue

    const { platformPart, usernamePart } = split
    let platform: SourcePlatform | null = null

    if (platformPart) {
      platform = resolveBulkSourcePlatformAlias(platformPart)
      if (!platform) {
        errors.push({
          lineNumber,
          message: `Invalid platform "${platformPart}". Use instagram, youtube, tiktok, or facebook.`,
        })
        continue
      }
    } else {
      platform = defaultPlatform
    }

    const username = sanitizeSourceIdentityInput(platform, usernamePart)
    if (!username.trim()) {
      errors.push({ lineNumber, message: 'Source username is empty.' })
      continue
    }

    const dedupeKey = buildBulkSourceDedupeKey(platform, username)
    const firstLine = seenKeys.get(dedupeKey)
    if (firstLine !== undefined) {
      warnings.push(`Line ${lineNumber} duplicates line ${firstLine} (${platform}|${username}) — ignored.`)
      continue
    }
    seenKeys.set(dedupeKey, lineNumber)

    sources.push({ lineNumber, platform, username, dedupeKey })
  }

  return { sources, errors, warnings }
}

export function shuffleWithRandom<T>(items: T[], randomFn: () => number = defaultRandom): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]!
    next[j] = tmp!
  }
  return next
}

function defaultRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint32Array(1)
    crypto.getRandomValues(buffer)
    return (buffer[0] ?? 0) / 0x100000000
  }
  return Math.random()
}

export function assignBulkSourcesRandomly(
  sources: ParsedBulkSource[],
  pages: BulkSourcePastePageTarget[],
  randomFn?: () => number,
): {
  assignments: BulkSourcePasteAssignmentPreview[]
  unassignedPageKeys: string[]
  assignmentByPageKey: Record<string, { sourcePlatform: SourcePlatform; sourceUsername: string }>
} {
  const shuffledPages = shuffleWithRandom(pages, randomFn)
  const count = Math.min(sources.length, shuffledPages.length)
  const assignments: BulkSourcePasteAssignmentPreview[] = []
  const assignmentByPageKey: Record<string, { sourcePlatform: SourcePlatform; sourceUsername: string }> = {}

  for (let i = 0; i < count; i++) {
    const source = sources[i]
    const page = shuffledPages[i]
    if (!source || !page) continue

    assignments.push({
      pageKey: page.key,
      pageName: page.pageName,
      platform: source.platform,
      username: source.username,
    })
    assignmentByPageKey[page.key] = {
      sourcePlatform: source.platform,
      sourceUsername: source.username,
    }
  }

  const unassignedPageKeys = shuffledPages.slice(count).map((page) => page.key)
  return { assignments, unassignedPageKeys, assignmentByPageKey }
}

export function buildBulkSourcePastePreview(
  text: string,
  pages: BulkSourcePastePageTarget[],
  defaultPlatform: SourcePlatform,
  existingByPageKey: Record<string, BulkSourcePasteExistingAssignment | undefined> = {},
  randomFn?: () => number,
): BulkSourcePastePreview {
  const parsed = parseBulkSourcePasteLines(text, defaultPlatform)
  const errors = parsed.errors
  const warnings = [...parsed.warnings]

  const { sources: assignableSources, warnings: existingWarnings } = filterSourcesNotAlreadyOnPages(
    parsed.sources,
    pages,
    existingByPageKey,
  )
  warnings.push(...existingWarnings)

  const emptyPages = emptyPagesForPaste(pages, existingByPageKey)

  let overflowError: string | null = null
  if (assignableSources.length > emptyPages.length) {
    const slotLabel = emptyPages.length === 1 ? 'empty page slot' : 'empty page slots'
    overflowError = `You have ${assignableSources.length} sources but only ${emptyPages.length} ${slotLabel}. Remove ${assignableSources.length - emptyPages.length} line(s) and try again.`
  }

  if (overflowError || assignableSources.length === 0 || emptyPages.length === 0) {
    return {
      sources: assignableSources,
      errors,
      warnings,
      overflowError,
      assignments: [],
      unassignedPageKeys: emptyPages.map((page) => page.key),
      assignmentByPageKey: {},
    }
  }

  const { assignments, unassignedPageKeys, assignmentByPageKey } = assignBulkSourcesRandomly(
    assignableSources,
    emptyPages,
    randomFn,
  )

  return {
    sources: assignableSources,
    errors,
    warnings,
    overflowError,
    assignments,
    unassignedPageKeys,
    assignmentByPageKey,
  }
}

export function canApplyBulkSourcePastePreview(preview: BulkSourcePastePreview): boolean {
  return (
    preview.sources.length > 0 &&
    !preview.overflowError &&
    preview.assignments.length > 0
  )
}
