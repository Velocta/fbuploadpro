import { describe, expect, it } from 'vitest'
import { stripHtmlToPlainText, normalizeItemGuid, hardCutCaption } from './feed'

describe('rss feed utils', () => {
  it('strips HTML to plain text', () => {
    const html = '<p>Hello <strong>world</strong></p><a href="https://x.com">link</a>'
    expect(stripHtmlToPlainText(html)).toBe('Hello world\nlink')
  })

  it('normalizes guid from link', () => {
    expect(normalizeItemGuid({ link: 'https://example.com/a' })).toBe('https://example.com/a')
  })

  it('hard cuts caption at facebook max', () => {
    const long = 'a'.repeat(70000)
    expect(hardCutCaption(long).length).toBe(63206)
  })
})
