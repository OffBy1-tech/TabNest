// Per-device popup state persisted in chrome.storage.local: the most recently
// used save targets and the last-selected workspace. All accessors degrade
// gracefully outside an extension context.

export interface RecentGroup {
  groupId: string
  groupName: string
  categoryId: string
  workspaceId: string
}

export const RECENT_GROUPS_KEY = 'tabnest_popup_recent_groups'
export const LAST_WORKSPACE_KEY = 'tabnest_popup_last_workspace'
export const MAX_RECENT = 3

export async function loadRecentGroups(): Promise<RecentGroup[]> {
  try {
    const result = await chrome.storage.local.get(RECENT_GROUPS_KEY)
    const raw = result[RECENT_GROUPS_KEY]
    if (Array.isArray(raw)) return raw as RecentGroup[]
  } catch {
    // Non-extension context
  }
  return []
}

export async function saveRecentGroups(groups: RecentGroup[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [RECENT_GROUPS_KEY]: groups })
  } catch {
    // Non-extension context
  }
}

export async function loadLastWorkspaceId(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(LAST_WORKSPACE_KEY)
    const raw = result[LAST_WORKSPACE_KEY]
    return typeof raw === 'string' ? raw : null
  } catch {
    return null
  }
}

export async function saveLastWorkspaceId(id: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [LAST_WORKSPACE_KEY]: id })
  } catch {
    // Non-extension context
  }
}

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
