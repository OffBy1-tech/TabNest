import { afterEach, describe, expect, it, vi } from 'vitest'
import { isHttpUrl, isSafeImageUrl, resolveFaviconUrl } from './safeUrl'

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('https://example.com/path?q=1')).toBe(true)
  })

  it('rejects non-navigable / dangerous schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'chrome://settings',
      'chrome-extension://abc/page.html',
      'about:blank',
    ]) {
      expect(isHttpUrl(url), url).toBe(false)
    }
  })

  it('rejects malformed input without throwing', () => {
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })
})

describe('isSafeImageUrl', () => {
  it('accepts http(s) and data: (valid <img> sources)', () => {
    expect(isSafeImageUrl('https://example.com/favicon.ico')).toBe(true)
    expect(isSafeImageUrl('http://example.com/favicon.ico')).toBe(true)
    expect(isSafeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
  })

  it('rejects javascript:/file:/chrome: and garbage', () => {
    for (const url of ['javascript:alert(1)', 'file:///x', 'chrome://favicon', '', 'nope']) {
      expect(isSafeImageUrl(url), url).toBe(false)
    }
  })
})

describe('resolveFaviconUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the scheme-filtered stored favicon when no extension context', () => {
    // chrome is undefined in the jsdom unit env
    expect(resolveFaviconUrl('https://example.com', 'https://example.com/icon.png')).toBe(
      'https://example.com/icon.png',
    )
  })

  it('drops an unsafe stored favicon in the fallback path (letter avatar)', () => {
    expect(resolveFaviconUrl(undefined, 'javascript:alert(1)')).toBe('')
    expect(resolveFaviconUrl(undefined, undefined)).toBe('')
  })

  it('prefers the local _favicon service when available, encoding the page URL', () => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (p: string) => `chrome-extension://ext-id${p}` },
    })
    const out = resolveFaviconUrl('https://example.com/a?b=c', 'https://evil.com/beacon', 32)
    // (chrome-extension:// is a non-special scheme, so URL.origin is opaque
    // ("null") — assert on the serialized value and its parsed parts instead.)
    expect(out.startsWith('chrome-extension://ext-id/_favicon/')).toBe(true)
    const u = new URL(out)
    expect(u.pathname).toBe('/_favicon/')
    expect(u.searchParams.get('pageUrl')).toBe('https://example.com/a?b=c')
    expect(u.searchParams.get('size')).toBe('32')
    // The attacker-controlled stored favicon host never appears in the src.
    expect(out).not.toContain('evil.com')
  })

  it('does not use _favicon for a non-http page URL even in an extension context', () => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (p: string) => `chrome-extension://ext-id${p}` },
    })
    // pageUrl is a file: URL → skip _favicon, fall back to the safe stored favicon
    expect(resolveFaviconUrl('file:///x', 'https://example.com/icon.png')).toBe(
      'https://example.com/icon.png',
    )
  })
})
