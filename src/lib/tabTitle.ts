/**
 * tabTitle.ts
 * Helpers for deriving display titles and normalizing user-entered URLs
 * when saving tabs.
 */

/**
 * Return the given title, or fall back to the URL's hostname when the title
 * is missing/blank (spec §17: never show a raw URL as a tab title).
 * Falls back to the raw URL only if it cannot be parsed.
 */
export function tabTitleOrHostname(title: string | undefined | null, url: string): string {
  const trimmed = title?.trim()
  if (trimmed) return trimmed
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Normalize a user-entered URL for manual tab entry: trims whitespace and
 * prepends https:// when no scheme is present. Returns null when the result
 * still isn't a valid http(s) URL.
 */
export function normalizeUrlInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // A colon followed by digits is a port (localhost:3000), not a scheme.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?![0-9])/.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    // Require a dot or localhost so bare words like "foo" don't become https://foo
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return null
    return parsed.href
  } catch {
    return null
  }
}
