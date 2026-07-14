import { isHttpUrl } from '../lib/safeUrl'

// Saved-tab URLs are semi-untrusted (Drive sync / JSON import) and only http(s)
// is safe to navigate to — `data:`/`file:`/`javascript:` would surface phishing
// or local-file pages. Gate every open path on `isHttpUrl`. (The context-menu
// save path in the background worker rejects `chrome://` for the same reason.)
const isSafeUrl = isHttpUrl

/**
 * Open a saved tab's URL according to the user's `open_tab_behavior` setting.
 *
 * - `current`   → navigate the current page
 * - `new_window`→ a real Chrome window (window.open '_blank' only makes a tab,
 *                 so we use chrome.windows.create; falls back to window.open
 *                 outside an extension context)
 * - `new_tab`   → a new tab (default)
 */
export function openTab(url: string, behavior: string | undefined): void {
  if (!isSafeUrl(url)) return
  if (behavior === 'current') {
    window.location.href = url
  } else if (behavior === 'new_window') {
    try {
      chrome.windows.create({ url })
    } catch {
      // Non-extension context (e.g. dev server) — fall back to window.open.
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } else {
    // 'new_tab' is the default
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Open a whole group of URLs according to `open_tab_behavior`.
 *
 * - `new_window` → one new Chrome window containing all the tabs
 * - `current`    → tabs added to the current Chrome window (navigating the
 *                  current page per-URL would leave only the last one open);
 *                  opened unfocused so the user stays on the manager
 * - `new_tab`    → one new tab per URL (default)
 */
export function openAllTabs(urls: string[], behavior: string | undefined): void {
  urls = urls.filter(isSafeUrl)
  if (urls.length === 0) return

  if (behavior === 'new_window') {
    try {
      chrome.windows.create({ url: urls })
      return
    } catch {
      // Non-extension context — fall through to per-URL window.open.
    }
  } else if (behavior === 'current') {
    try {
      for (const url of urls) {
        chrome.tabs.create({ url, active: false })
      }
      return
    } catch {
      // Non-extension context — fall through to per-URL window.open.
    }
  }

  for (const url of urls) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * "Open All in Background" (spec §6.3): opens all URLs together in a new
 * Chrome window without stealing focus from the current window.
 */
export function openAllTabsInBackground(urls: string[]): void {
  urls = urls.filter(isSafeUrl)
  if (urls.length === 0) return
  try {
    chrome.windows.create({ url: urls, focused: false })
  } catch {
    // Non-extension context — window.open can't open unfocused; best effort.
    for (const url of urls) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
}
