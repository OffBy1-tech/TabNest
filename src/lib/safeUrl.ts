/**
 * URL-scheme allowlists for the two places tabNest consumes semi-untrusted URLs
 * (saved-tab data arrives via Drive sync and JSON import; the storage schema's
 * `z.string().url()` accepts `javascript:`, `data:`, `file:`, and `chrome:` too).
 *
 * - `isHttpUrl`      — for *navigation* (opening a saved tab). http(s) only:
 *                      `data:`/`file:` would open phishing / local-file pages.
 * - `isSafeImageUrl` — for an `<img src>` (favicons). Allows http(s) and `data:`
 *                      (inline image bytes; no script, decoded as an image only)
 *                      but blocks `javascript:`/`file:`/`chrome:`/etc.
 *
 * NOTE: `isSafeImageUrl` does NOT prevent a crafted favicon from pointing at an
 * attacker-controlled *https* host (a tracking/deanonymization beacon fires on
 * render). That is inherent to showing real cross-origin favicons and can't be
 * host-allowlisted without breaking legitimate icons (many sites serve favicons
 * from a separate asset host). The CSP `connect-src` restriction closes the more
 * serious script/fetch exfil channels; fully eliminating the img beacon would
 * require routing favicons through Chrome's local `_favicon` API.
 */

export function isHttpUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

export function isSafeImageUrl(url: string): boolean {
  try {
    return ['http:', 'https:', 'data:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

/**
 * Resolve the `<img src>` to use for a saved tab's favicon.
 *
 * Prefers Chrome's local `_favicon` service (requires the `favicon` permission):
 * it serves the icon from the browser's own cache with NO network request to the
 * site, so a crafted `favicon` value in imported/synced data cannot fire a
 * tracking/deanonymization beacon. Falls back to the stored favicon (scheme-
 * filtered) when the `_favicon` service is unavailable — i.e. the dev server /
 * any non-extension context, or when the page URL isn't http(s). Returns `''`
 * when nothing safe is available (caller shows a letter avatar).
 */
export function resolveFaviconUrl(
  pageUrl: string | undefined,
  storedFavicon: string | undefined,
  size = 16,
): string {
  if (
    pageUrl &&
    isHttpUrl(pageUrl) &&
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime?.getURL === 'function'
  ) {
    const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'))
    faviconUrl.searchParams.set('pageUrl', pageUrl)
    faviconUrl.searchParams.set('size', String(size))
    return faviconUrl.toString()
  }
  if (storedFavicon && isSafeImageUrl(storedFavicon)) return storedFavicon
  return ''
}
