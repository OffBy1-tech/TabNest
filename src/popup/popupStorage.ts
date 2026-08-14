// Pure helpers for the popup's per-device recent-groups list. All
// chrome.storage IO lives in lib/storage (readPopupState /
// writePopupRecentGroups / writePopupLastWorkspaceId) per the "only
// storage.ts touches chrome.storage" contract.

import type { PopupRecentGroup } from '../lib/storage'

export type RecentGroup = PopupRecentGroup

export const MAX_RECENT = 3

/**
 * Prepend `next` to the recents list, removing any prior entry for the same
 * group+category pair, and cap the list at MAX_RECENT.
 */
export function pushRecentGroup(existing: RecentGroup[], next: RecentGroup): RecentGroup[] {
  const filtered = existing.filter(
    (g) => !(g.groupId === next.groupId && g.categoryId === next.categoryId),
  )
  return [next, ...filtered].slice(0, MAX_RECENT)
}
