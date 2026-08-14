/**
 * Shared test harness for storage.ts — the chrome.storage mock, the document
 * fixtures, and the synced-state helpers that both storage.test.ts (per-helper
 * behavior) and storageContract.test.ts (the cross-cutting mutation contract)
 * need.
 *
 * Kept out of testFixtures.ts on purpose: those builders use plain-string ids
 * that fail Zod validation, which storage.ts enforces at its boundaries. These
 * builders carry real UUIDs.
 *
 * Importing this module installs the chrome mock as a side effect, so it must
 * be imported before any module that touches `chrome` at import time.
 */

import { vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  SCHEMA_VERSION,
  type StorageSchema,
  type Workspace,
  type Category,
  type TabGroup,
  type SavedTab,
  type TrashItem,
  type BackupGeneration,
} from './schema'

// ---------------------------------------------------------------------------
// chrome.storage.local mock — in-memory, deliberately asynchronous (setTimeout)
// so that unserialized concurrent writes would actually interleave and expose
// read-before-write races that the writeQueue contract must prevent.
// ---------------------------------------------------------------------------

let store: Record<string, unknown> = {}
let nextSetErrorMessage: string | null = null

export const chromeMock = {
  runtime: { lastError: undefined as { message: string } | undefined },
  storage: {
    local: {
      get: (key: string | string[], cb: (result: Record<string, unknown>) => void): void => {
        setTimeout(() => {
          const keys = Array.isArray(key) ? key : [key]
          cb(Object.fromEntries(keys.map((k) => [k, store[k]])))
        }, 0)
      },
      set: (items: Record<string, unknown>, cb: () => void): void => {
        setTimeout(() => {
          if (nextSetErrorMessage !== null) {
            chromeMock.runtime.lastError = { message: nextSetErrorMessage }
            nextSetErrorMessage = null
            cb()
            chromeMock.runtime.lastError = undefined
            return
          }
          Object.assign(store, items)
          cb()
        }, 0)
      },
      remove: (key: string, cb: () => void): void => {
        setTimeout(() => {
          delete store[key]
          cb()
        }, 0)
      },
    },
  },
}

vi.stubGlobal('chrome', chromeMock)

/** Make the next chrome.storage.local.set fail with this message (quota tests). */
export function setNextSetError(message: string | null): void {
  nextSetErrorMessage = message
}

/**
 * Reset the mock store and hand back a fresh storage module.
 *
 * storage.ts holds module-level state (the writeQueue promise chain), so each
 * test needs its own copy for isolation — call this from `beforeEach`.
 */
export async function freshStorage(): Promise<typeof import('./storage')> {
  store = {}
  nextSetErrorMessage = null
  vi.resetModules()
  return import('./storage')
}

/** Read a raw mock storage key — for device-only keys and pre-migration shapes. */
export function storeKey(key: string): unknown {
  return store[key]
}

/** Write a raw mock storage key, bypassing schema validation (migration tests). */
export function setStoreKey(key: string, value: unknown): void {
  store[key] = value
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export function makeTab(title = 'Tab'): SavedTab {
  return { id: crypto.randomUUID(), title, url: 'https://example.com/', saved_at: Date.now() }
}

export function makeGroup(name = 'Group', tabs: SavedTab[] = []): TabGroup {
  const now = Date.now()
  return { id: crypto.randomUUID(), name, created_at: now, updated_at: now, order: 0, tabs, notes: [] }
}

export function makeCategory(name = 'Category', groups: TabGroup[] = []): Category {
  return { id: crypto.randomUUID(), name, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups, notes: [] }
}

export function makeWorkspace(name = 'Workspace', categories: Category[] = [makeCategory()]): Workspace {
  return { id: crypto.randomUUID(), name, created_at: Date.now(), categories }
}

/** Seed the mock store with a full valid document and return it. */
export function seed(
  workspaces: Workspace[] = [makeWorkspace()],
  trash: TrashItem[] = [],
): StorageSchema {
  const data: StorageSchema = {
    schema_version: SCHEMA_VERSION,
    workspaces,
    settings: { ...DEFAULT_SETTINGS, default_workspace_id: workspaces[0]?.id ?? null },
    local_settings: { ...DEFAULT_LOCAL_SETTINGS },
    sync_meta: DEFAULT_SYNC_META(),
    trash,
  }
  store['tabnest_data'] = data
  return data
}

export function stored(): StorageSchema {
  return store['tabnest_data'] as StorageSchema
}

export function storedBackups(): BackupGeneration[] | undefined {
  return store['tabnest_backups'] as BackupGeneration[] | undefined
}

/** A timestamp comfortably older than anything a mutation stamps during a test. */
export const past = (): number => Date.now() - 60_000

/** The synced half of the current document — the shape mergeSyncedState takes. */
export const current = (): { workspaces: Workspace[]; trash: TrashItem[] } => ({
  workspaces: stored().workspaces,
  trash: stored().trash,
})

/** A detached copy of `current()`, standing in for another device's state. */
export const snapshot = (): { workspaces: Workspace[]; trash: TrashItem[] } =>
  structuredClone(current())
