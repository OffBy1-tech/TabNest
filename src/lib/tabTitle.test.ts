import { describe, it, expect } from 'vitest'
import { tabTitleOrHostname, normalizeUrlInput } from './tabTitle'

describe('tabTitleOrHostname', () => {
  it('returns the title when present', () => {
    expect(tabTitleOrHostname('My Page', 'https://example.com/x')).toBe('My Page')
  })

  it('falls back to the hostname for missing or blank titles', () => {
    expect(tabTitleOrHostname(undefined, 'https://docs.example.com/deep/path')).toBe('docs.example.com')
    expect(tabTitleOrHostname(null, 'https://example.com/')).toBe('example.com')
    expect(tabTitleOrHostname('   ', 'https://example.com/')).toBe('example.com')
  })

  it('falls back to the raw URL when it cannot be parsed', () => {
    expect(tabTitleOrHostname(undefined, 'not a url')).toBe('not a url')
  })
})

describe('normalizeUrlInput', () => {
  it('accepts full http(s) URLs', () => {
    expect(normalizeUrlInput('https://example.com/page')).toBe('https://example.com/page')
    expect(normalizeUrlInput('http://example.com')).toBe('http://example.com/')
  })

  it('prepends https:// when the scheme is missing', () => {
    expect(normalizeUrlInput('example.com/page')).toBe('https://example.com/page')
    expect(normalizeUrlInput('  example.com  ')).toBe('https://example.com/')
  })

  it('accepts localhost', () => {
    expect(normalizeUrlInput('localhost:3000')).toBe('https://localhost:3000/')
  })

  it('rejects empty input, bare words, and non-http schemes', () => {
    expect(normalizeUrlInput('')).toBeNull()
    expect(normalizeUrlInput('   ')).toBeNull()
    expect(normalizeUrlInput('foo')).toBeNull()
    expect(normalizeUrlInput('javascript:alert(1)')).toBeNull()
    expect(normalizeUrlInput('ftp://example.com')).toBeNull()
  })
})
