/**
 * Tab Nest background service worker (Chrome MV3)
 *
 * Rules:
 * - No eval(), no new Function(), no remote code loading
 * - No setInterval / setTimeout for periodic work — use chrome.alarms
 * - All state persisted in chrome.storage.local (worker is non-persistent)
 */

import {
  migrateIfNeeded,
  readStorage,
  writeStorage,
  patchSyncMeta,
  patchLocalSettings,
  getSyncMeta,
  purgeTrashOlderThan,
  saveTabGroup,
  addTabToGroup,
  deleteTabGroup,
  restoreFromTrash,
} from '../lib/storage'
import {
  StorageSchemaZod,
  type ExtensionMessage,
  type MessageResponse,
  type SavedTab,
  type Workspace,
  type Category,
  type TabGroup,
  type TrashItem,
  ExtensionMessageSchema,
} from '../lib/schema'

// ---------------------------------------------------------------------------
// Alarm names
// ---------------------------------------------------------------------------

const ALARM_SYNC = 'sync'
const ALARM_TRASH_PURGE = 'trash_purge'
const ALARM_RETRY_SYNC = 'retry_sync'

// ---------------------------------------------------------------------------
// onInstalled
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  // 1. Migrate schema (also initializes storage on fresh install)
  await migrateIfNeeded()

  // 2. Ensure device_id is set
  const meta = await getSyncMeta()
  if (!meta.device_id) {
    await patchSyncMeta({ device_id: crypto.randomUUID() })
  }

  // 3. Register periodic alarms — use per-device sync interval from local_settings
  const installData = await readStorage()
  const syncIntervalMinutes = installData.local_settings.sync_interval_minutes ?? 5
  chrome.alarms.create(ALARM_SYNC, { periodInMinutes: syncIntervalMinutes })
  chrome.alarms.create(ALARM_TRASH_PURGE, { periodInMinutes: 1440 }) // daily

  // 4. Register context menus
  await buildContextMenus()

  if (details.reason === 'install') {
    console.log('[tabNest] Installed successfully.')
  } else if (details.reason === 'update') {
    console.log(`[tabNest] Updated from ${details.previousVersion ?? 'unknown'}.`)
  }
})

// Rebuild context menus on browser startup — MV3 service workers are non-persistent
// so menus registered at install time are gone after a browser restart.
chrome.runtime.onStartup.addListener(() => {
  buildContextMenus().catch((err) => console.error('[tabNest] buildContextMenus failed:', err))
})

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case ALARM_SYNC:
    case ALARM_RETRY_SYNC:
      await runSync()
      break
    case ALARM_TRASH_PURGE:
      await purgeTrashOlderThan(30)
      break
    default:
      break
  }
})

// ---------------------------------------------------------------------------
// Context menus
// ---------------------------------------------------------------------------

// Rebuild the full context menu tree from current storage. Called on install,
// startup, and whenever the workspace structure changes.
async function buildContextMenus(): Promise<void> {
  const data = await readStorage()
  await new Promise<void>((resolve) => chrome.contextMenus.removeAll(resolve))

  chrome.contextMenus.create({ id: 'save-page', title: 'Save to Tab Nest', contexts: ['page'] })
  chrome.contextMenus.create({ id: 'save-link', title: 'Save Link to Tab Nest', contexts: ['link'] })

  const { workspaces } = data
  const multiWs = workspaces.length > 1

  for (const ws of workspaces) {
    if (multiWs) {
      chrome.contextMenus.create({ id: `p:ws:${ws.id}`, parentId: 'save-page', title: ws.name, contexts: ['page'] })
      chrome.contextMenus.create({ id: `l:ws:${ws.id}`, parentId: 'save-link', title: ws.name, contexts: ['link'] })
    }

    for (const cat of ws.categories) {
      const pageParent = multiWs ? `p:ws:${ws.id}` : 'save-page'
      const linkParent = multiWs ? `l:ws:${ws.id}` : 'save-link'

      chrome.contextMenus.create({ id: `p:cat:${ws.id}:${cat.id}`, parentId: pageParent, title: cat.name, contexts: ['page'] })
      chrome.contextMenus.create({ id: `l:cat:${ws.id}:${cat.id}`, parentId: linkParent, title: cat.name, contexts: ['link'] })

      for (const grp of cat.groups) {
        chrome.contextMenus.create({ id: `p:grp:${ws.id}:${cat.id}:${grp.id}`, parentId: `p:cat:${ws.id}:${cat.id}`, title: grp.name, contexts: ['page'] })
        chrome.contextMenus.create({ id: `l:grp:${ws.id}:${cat.id}:${grp.id}`, parentId: `l:cat:${ws.id}:${cat.id}`, title: grp.name, contexts: ['link'] })
      }

      if (cat.groups.length > 0) {
        chrome.contextMenus.create({ id: `p:sep:${ws.id}:${cat.id}`, parentId: `p:cat:${ws.id}:${cat.id}`, type: 'separator', contexts: ['page'] })
        chrome.contextMenus.create({ id: `l:sep:${ws.id}:${cat.id}`, parentId: `l:cat:${ws.id}:${cat.id}`, type: 'separator', contexts: ['link'] })
      }

      chrome.contextMenus.create({ id: `p:new:${ws.id}:${cat.id}`, parentId: `p:cat:${ws.id}:${cat.id}`, title: '+ New Group', contexts: ['page'] })
      chrome.contextMenus.create({ id: `l:new:${ws.id}:${cat.id}`, parentId: `l:cat:${ws.id}:${cat.id}`, title: '+ New Group', contexts: ['link'] })
    }
  }
}

function makeGroup(tab: SavedTab, url: string, order: number) {
  let name = url
  try { name = new URL(url).hostname } catch { /* keep raw url */ }
  return {
    id: crypto.randomUUID(),
    name,
    created_at: Date.now(),
    updated_at: Date.now(),
    order,
    tabs: [tab],
    notes: [] as never[],
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab == null) return

  const menuId = String(info.menuItemId)
  const isLink = menuId.startsWith('l:') || menuId === 'save-link'
  const url = isLink ? (info.linkUrl ?? info.pageUrl ?? '') : (tab.url ?? '')

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return

  const savedTab: SavedTab = {
    id: crypto.randomUUID(),
    title: isLink ? (info.linkUrl ?? url) : (tab.title ?? url),
    url,
    favicon: tab.favIconUrl,
    saved_at: Date.now(),
  }

  try {
    // Root items and workspace items → save to first category of that workspace
    if (menuId === 'save-page' || menuId === 'save-link' || menuId.split(':')[1] === 'ws') {
      const data = await readStorage()
      const wsId = menuId.split(':')[2]
      const workspace = (wsId ? data.workspaces.find((w) => w.id === wsId) : null) ?? data.workspaces[0]
      const category = workspace?.categories[0]
      if (!workspace || !category) return
      await saveTabGroup({ group: makeGroup(savedTab, url, category.groups.length), categoryId: category.id, workspaceId: workspace.id })
      return
    }

    const [, type, wsId, catId, grpId] = menuId.split(':')

    if (type === 'grp' && wsId && catId && grpId) {
      // Add to existing group
      await addTabToGroup(wsId, catId, grpId, savedTab)
    } else if ((type === 'new' || type === 'cat') && wsId && catId) {
      // Create a new group in this category
      const data = await readStorage()
      const order = data.workspaces.find((w) => w.id === wsId)?.categories.find((c) => c.id === catId)?.groups.length ?? 0
      await saveTabGroup({ group: makeGroup(savedTab, url, order), categoryId: catId, workspaceId: wsId })
    }
    // 'sep' and 'ws' items are navigational — no action needed
  } catch (err) {
    console.error('[tabNest] context menu save failed:', err)
  }
})

// ---------------------------------------------------------------------------
// Message passing — newtab / popup ↔ service worker
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (rawMessage: unknown, _sender, sendResponse: (r: MessageResponse) => void) => {
    const parsed = ExtensionMessageSchema.safeParse(rawMessage)
    if (!parsed.success) {
      sendResponse({ ok: false, error: 'Invalid message format' })
      return true
    }

    const message = parsed.data as ExtensionMessage
    handleMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      )

    // Return true to keep the message channel open for async response
    return true
  },
)

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_ALL_DATA':
      return readStorage()

    case 'GET_SYNC_STATUS':
      return getSyncMeta()

    case 'TRIGGER_SYNC':
      await runSync()
      return getSyncMeta()

    case 'CONNECT_DRIVE':
      return connectDrive()

    case 'DISCONNECT_DRIVE':
      await patchSyncMeta({ drive_file_id: null, sync_state: 'idle', error_message: null })
      await patchLocalSettings({ sync_enabled: false })
      return { ok: true }

    case 'SAVE_TABS': {
      const { tabs, group_name, category_id, workspace_id } = message.payload
      const group = {
        id: crypto.randomUUID(),
        name: group_name,
        created_at: Date.now(),
        updated_at: Date.now(),
        order: 0,
        tabs,
        notes: [],
      }
      await saveTabGroup({ group, categoryId: category_id, workspaceId: workspace_id })
      return { saved: tabs.length }
    }

    case 'DELETE_GROUP': {
      const { group_id, category_id, workspace_id } = message.payload
      // Use the storage layer's deleteTabGroup which correctly moves to trash
      const trashItem = await deleteTabGroup({
        groupId: group_id,
        categoryId: category_id,
        workspaceId: workspace_id,
      })
      return { trashed: trashItem.id }
    }

    case 'MOVE_TO_TRASH': {
      const data = await readStorage()
      const trash = [...data.trash, message.payload]
      await writeStorage({ trash })
      return { trashed: message.payload.id }
    }

    case 'RESTORE_FROM_TRASH':
      await restoreFromTrash(message.payload.item_id)
      return { restored: message.payload.item_id }

    default:
      throw new Error('Unhandled message type')
  }
}

// ---------------------------------------------------------------------------
// React to local_settings changes (e.g., sync interval updated via UI)
// ---------------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  const dataChange = changes['tabnest_data']
  if (!dataChange?.newValue) return

  type StorageData = {
    local_settings?: { sync_interval_minutes?: number }
    workspaces?: unknown
  }
  const oldData = dataChange.oldValue as StorageData | undefined
  const newData = dataChange.newValue as StorageData

  const oldInterval = oldData?.local_settings?.sync_interval_minutes
  const newInterval = newData.local_settings?.sync_interval_minutes

  if (newInterval !== oldInterval && typeof newInterval === 'number') {
    // Recreate the sync alarm with the new interval — chrome.alarms.create
    // overwrites an existing alarm of the same name, replacing the period.
    chrome.alarms.create(ALARM_SYNC, { periodInMinutes: newInterval })
  }

  // Rebuild context menus whenever the workspace structure changes (groups/categories added/removed/renamed)
  if (JSON.stringify(oldData?.workspaces) !== JSON.stringify(newData.workspaces)) {
    buildContextMenus().catch((err) => console.error('[tabNest] buildContextMenus failed:', err))
  }
})

// ---------------------------------------------------------------------------
// Sync state machine
// ---------------------------------------------------------------------------

async function runSync(): Promise<void> {
  const data = await readStorage()
  const meta = data.sync_meta
  // sync_enabled is per-device — lives in local_settings, never synced to Drive
  if (!data.local_settings.sync_enabled) return

  if (!navigator.onLine) {
    await patchSyncMeta({ pending_sync: true })
    return
  }

  await patchSyncMeta({ sync_state: 'syncing', error_message: null })

  try {
    const token = await acquireToken(false)
    if (!token) {
      // Token not available non-interactively (user hasn't authorized yet)
      await patchSyncMeta({ sync_state: 'idle' })
      return
    }

    const local = await readStorage()
    const fileId = await findOrCreateDriveFile(token, meta.drive_file_id)

    // Compare timestamps to determine winner
    const remote = await readDriveFile(token, fileId)

    if (remote !== null && meta.last_sync_at === 0) {
      // First connect on this device — Drive already has data from another device.
      // Union both sides so neither device loses tabs. Settings go to whichever
      // side was more recently modified; trash is unioned by id.
      const mergedWorkspaces = mergeWorkspaces(local.workspaces, remote.workspaces)
      const mergedTrash = mergeTrash(local.trash, remote.trash)
      const mergedSettings =
        remote.sync_meta.last_modified_at > local.sync_meta.last_modified_at
          ? remote.settings
          : local.settings
      await writeStorage({ workspaces: mergedWorkspaces, settings: mergedSettings, trash: mergedTrash })
      await writeDriveFile(token, fileId, await readStorage())
    } else if (remote !== null && remote.sync_meta.last_modified_at > local.sync_meta.last_modified_at) {
      // Remote wins — back up local workspaces, then apply full remote state.
      // Apply settings and trash too (not just workspaces) so all synced fields
      // actually propagate. Then restore remote's last_modified_at — writeStorage
      // bumps it to Date.now() on any workspaces/settings/trash write, which would
      // make local appear newer than remote on the next sync cycle.
      await writeStorage({ backup_local: local.workspaces })
      await writeStorage({ workspaces: remote.workspaces, settings: remote.settings, trash: remote.trash })
      await patchSyncMeta({ last_modified_at: remote.sync_meta.last_modified_at })
    } else {
      // Local wins — push to Drive
      await writeDriveFile(token, fileId, local)
    }

    await patchSyncMeta({
      sync_state: 'idle',
      last_sync_at: Date.now(),
      pending_sync: false,
      retry_count: 0,
      drive_file_id: fileId,
      error_message: null,
    })
  } catch (err) {
    const retryCount = meta.retry_count + 1
    if (retryCount >= 3) {
      await patchSyncMeta({
        sync_state: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        retry_count: retryCount,
      })
    } else {
      await patchSyncMeta({
        sync_state: 'error',
        retry_count: retryCount,
      })
      const delayMinutes = (30 * Math.pow(2, retryCount - 1)) / 60
      // Clear any existing retry alarm before creating a new one (prevents duplicates)
      chrome.alarms.clear(ALARM_RETRY_SYNC, () => {
        chrome.alarms.create(ALARM_RETRY_SYNC, { delayInMinutes: delayMinutes })
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Google Drive helpers (deferred — called only when user has connected)
// ---------------------------------------------------------------------------

async function acquireToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const token = typeof result === 'string' ? result : result?.token
      if (chrome.runtime.lastError || !token) {
        resolve(null)
      } else {
        resolve(token)
      }
    })
  })
}

async function connectDrive(): Promise<{ connected: boolean }> {
  // Clear any cached token so Chrome shows a fresh account picker / consent screen
  await new Promise<void>((resolve) => chrome.identity.clearAllCachedAuthTokens(resolve))

  const token = await acquireToken(true)
  if (!token) return { connected: false }

  // Find or create the Drive file and persist the stable file ID so the UI
  // can show "Connected" immediately (isConnected = drive_file_id !== null).
  const data = await readStorage()
  const fileId = await findOrCreateDriveFile(token, data.sync_meta.drive_file_id)
  await patchSyncMeta({ drive_file_id: fileId, sync_state: 'idle', error_message: null })

  // Enable sync on this device
  await patchLocalSettings({ sync_enabled: true })

  // Kick off the first sync via alarm rather than awaiting it here — Drive API
  // round-trips can outlive the message channel and cause the UI to spin forever.
  // Recreate with periodInMinutes so the periodic schedule is preserved — creating
  // an alarm with the same name replaces the old one, and omitting periodInMinutes
  // would turn the periodic alarm into a one-shot, killing all future auto-syncs.
  const syncIntervalMinutes = data.local_settings.sync_interval_minutes ?? 5
  chrome.alarms.create(ALARM_SYNC, { delayInMinutes: 0, periodInMinutes: syncIntervalMinutes })

  return { connected: true }
}

// ---------------------------------------------------------------------------
// Drive fetch with timeout — prevents hung requests from killing the SW silently
// ---------------------------------------------------------------------------

async function driveFetch(url: string, options: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function findOrCreateDriveFile(
  token: string,
  existingFileId: string | null,
): Promise<string> {
  const DRIVE_API = 'https://www.googleapis.com/drive/v3'
  const headers = { Authorization: `Bearer ${token}` }

  if (existingFileId) {
    // Verify it still exists
    const check = await driveFetch(`${DRIVE_API}/files/${existingFileId}?fields=id`, { headers })
    if (check.ok) return existingFileId
  }

  const search = await driveFetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=name='tabnest_data.json' and trashed=false&fields=files(id)`,
    { headers },
  )
  if (!search.ok) {
    throw new Error(`Drive search failed: ${search.status} ${search.statusText}`)
  }
  const searchData = await search.json() as { files?: Array<{ id: string }> }
  if (searchData.files && searchData.files.length > 0 && searchData.files[0]) {
    return searchData.files[0].id
  }

  const create = await driveFetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'tabnest_data.json',
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    }),
  })
  if (!create.ok) {
    throw new Error(`Drive file create failed: ${create.status} ${create.statusText}`)
  }
  const file = await create.json() as { id: string }
  return file.id
}

async function readDriveFile(token: string, fileId: string): Promise<import('../lib/schema').StorageSchema | null> {
  try {
    const res = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return null
    const raw: unknown = await res.json()
    // Validate with Zod before trusting remote data (BLOCKER fix)
    const parsed = StorageSchemaZod.safeParse(raw)
    if (!parsed.success) {
      console.error('[tabNest] Drive file failed schema validation:', parsed.error.issues)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

async function writeDriveFile(
  token: string,
  fileId: string,
  data: Awaited<ReturnType<typeof readStorage>>,
): Promise<void> {
  // Strip device-local fields before writing to Drive.
  // local_settings (sync_enabled, sync_interval_minutes) and backup_local are
  // per-device and must never be written to the shared Drive file.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { local_settings: _ls, backup_local: _bl, ...drivePayload } = data

  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(drivePayload),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive write failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`)
  }
}

// ---------------------------------------------------------------------------
// First-connect merge helpers
//
// Union local and remote by entity ID at each level of the hierarchy.
// Entities that exist on only one side are kept as-is. Entities that exist
// on both sides are merged: workspaces and categories recurse downward;
// groups take the copy with the higher updated_at. Order fields are
// renumbered after merging so there are no gaps or duplicates.
// ---------------------------------------------------------------------------

function mergeWorkspaces(local: Workspace[], remote: Workspace[]): Workspace[] {
  const localById = new Map(local.map((ws) => [ws.id, ws]))
  const remoteById = new Map(remote.map((ws) => [ws.id, ws]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  return [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (l && r) return { ...r, categories: mergeCategories(l.categories, r.categories) }
    return (l ?? r)!
  })
}

function mergeCategories(local: Category[], remote: Category[]): Category[] {
  const localById = new Map(local.map((c) => [c.id, c]))
  const remoteById = new Map(remote.map((c) => [c.id, c]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (l && r) return { ...r, groups: mergeGroups(l.groups, r.groups) }
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }))
}

function mergeGroups(local: TabGroup[], remote: TabGroup[]): TabGroup[] {
  const localById = new Map(local.map((g) => [g.id, g]))
  const remoteById = new Map(remote.map((g) => [g.id, g]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    // Group exists on both sides — keep the more recently updated copy
    if (l && r) return l.updated_at >= r.updated_at ? l : r
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((g, i) => ({ ...g, order: i }))
}

function mergeTrash(local: TrashItem[], remote: TrashItem[]): TrashItem[] {
  const localIds = new Set(local.map((t) => t.id))
  return [...local, ...remote.filter((t) => !localIds.has(t.id))]
}
