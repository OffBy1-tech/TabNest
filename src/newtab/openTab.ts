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
