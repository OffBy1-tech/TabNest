/**
 * schema.ts
 * Full data model types + Zod runtime validators for tabNest.
 * All chrome.storage reads/writes are validated against these schemas.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 5

// ---------------------------------------------------------------------------
// Core entities — Zod schemas first, TypeScript types inferred from them
// ---------------------------------------------------------------------------

export const SavedTabSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  url: z.string().url(),
  favicon: z.string().optional(),
  saved_at: z.number().int().positive(),       // epoch ms
  note: z.string().optional(),
})

export const NoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  created_at: z.number().int().positive(),     // epoch ms
  updated_at: z.number().int().positive(),     // epoch ms
})

export const TabGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.number().int().positive(),     // epoch ms
  updated_at: z.number().int().positive(),     // epoch ms
  order: z.number().int().nonnegative(),
  tabs: z.array(SavedTabSchema),
  notes: z.array(NoteSchema),
  archived: z.boolean().optional(),
})

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  emoji: z.string(),
  collapsed: z.boolean(),
  order: z.number().int().nonnegative(),
  groups: z.array(TabGroupSchema),
  /** Standalone notes (spec §7.1) — cards with no associated tabs. Defaulted so pre-existing data parses. */
  notes: z.array(NoteSchema).default([]),
})

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.number().int().positive(),     // epoch ms
  categories: z.array(CategorySchema),
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Shared UI preferences — synced to Drive across all devices.
 * Must NOT contain per-device fields (sync toggle, sync interval).
 */
export const UserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  default_view: z.enum(['grid', 'list']),
  open_tab_behavior: z.enum(['current', 'new_tab', 'new_window']),
  save_and_close: z.boolean(),
  show_favicons: z.boolean(),
  compact_mode: z.boolean(),
  active_tabs_on_load: z.boolean(),
  default_workspace_id: z.string().nullable(),
  show_clock: z.boolean(),
  /**
   * New-tab background: a preset id from BACKGROUND_PRESETS ('' = theme default).
   * Defaulted so pre-existing local and Drive documents parse cleanly.
   */
  background: z.string().default(''),
  /** When true, opening a whole group moves it to trash (spec §6.3 restore toggle). */
  delete_group_on_open: z.boolean().default(false),
})

/** Bounds for the user-resizable sidebar (px). */
export const SIDEBAR_WIDTH_MIN = 180
export const SIDEBAR_WIDTH_MAX = 600
export const SIDEBAR_WIDTH_DEFAULT = 240

/**
 * Per-device settings — stored in chrome.storage.local only, never written
 * to Drive. Each browser instance manages its own sync preferences independently.
 */
export const LocalSettingsSchema = z.object({
  sync_enabled: z.boolean(),
  sync_interval_minutes: z.union([
    z.literal(5),
    z.literal(15),
    z.literal(30),
    z.null(),
  ]),
  /** Sidebar width in px, set by the resize handle. Optional so pre-existing data parses. */
  sidebar_width: z.number().int().min(SIDEBAR_WIDTH_MIN).max(SIDEBAR_WIDTH_MAX).optional(),
})

// ---------------------------------------------------------------------------
// Sync metadata
// ---------------------------------------------------------------------------

export const SyncMetaSchema = z.object({
  drive_file_id: z.string().nullable(),
  last_sync_at: z.number().int().nonnegative(),        // epoch ms, 0 = never
  last_modified_at: z.number().int().nonnegative(),    // epoch ms
  device_id: z.string().uuid(),
  sync_state: z.enum(['idle', 'syncing', 'error']),
  pending_sync: z.boolean(),
  error_message: z.string().nullable(),
  retry_count: z.number().int().nonnegative(),
})

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

export const TrashLocationSchema = z.object({
  workspace_id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
})

export const TrashItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['group', 'tab', 'category', 'workspace']),
  // `data` holds the original entity — typed loosely to accommodate all union
  // members without recursive schema complexity; validated contextually.
  data: z.unknown(),
  original_location: TrashLocationSchema,
  deleted_at: z.number().int().positive(),             // epoch ms
})

// ---------------------------------------------------------------------------
// Storage root
// ---------------------------------------------------------------------------

export const StorageSchemaZod = z.object({
  schema_version: z.number().int().positive(),
  workspaces: z.array(WorkspaceSchema),
  settings: UserSettingsSchema,
  /**
   * Per-device settings (sync toggle, interval). Uses .default() so that
   * Drive-sourced data (which has no local_settings) always parses cleanly.
   */
  local_settings: LocalSettingsSchema.optional().default(() => ({
    sync_enabled: false,
    sync_interval_minutes: 15 as const,
  })),
  sync_meta: SyncMetaSchema,
  backup_local: z.array(WorkspaceSchema).optional(),
  trash: z.array(TrashItemSchema),
})

// ---------------------------------------------------------------------------
// Message passing
// ---------------------------------------------------------------------------

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SAVE_TABS'),
    payload: z.object({
      tabs: z.array(SavedTabSchema),
      group_name: z.string(),
      category_id: z.string().uuid(),
      workspace_id: z.string().uuid(),
    }),
  }),
  z.object({ type: z.literal('GET_ALL_DATA') }),
  z.object({ type: z.literal('TRIGGER_SYNC') }),
  z.object({ type: z.literal('CONNECT_DRIVE') }),
  z.object({ type: z.literal('DISCONNECT_DRIVE') }),
  z.object({ type: z.literal('GET_SYNC_STATUS') }),
  z.object({
    type: z.literal('DELETE_GROUP'),
    payload: z.object({
      group_id: z.string().uuid(),
      category_id: z.string().uuid(),
      workspace_id: z.string().uuid(),
    }),
  }),
  z.object({
    type: z.literal('MOVE_TO_TRASH'),
    payload: TrashItemSchema,
  }),
  z.object({
    type: z.literal('RESTORE_FROM_TRASH'),
    payload: z.object({ item_id: z.string().uuid() }),
  }),
  z.object({ type: z.literal('GET_DRIVE_REVISIONS') }),
  z.object({
    type: z.literal('RESTORE_DRIVE_REVISION'),
    payload: z.object({ revision_id: z.string() }),
  }),
])

/** A Drive revision entry shown in Settings > Restore (spec §9.2/§11.3). */
export interface DriveRevision {
  id: string
  modifiedTime: string
}

// ---------------------------------------------------------------------------
// TypeScript types inferred from Zod schemas
// ---------------------------------------------------------------------------

export type SavedTab = z.infer<typeof SavedTabSchema>
export type Note = z.infer<typeof NoteSchema>
export type TabGroup = z.infer<typeof TabGroupSchema>
export type Category = z.infer<typeof CategorySchema>
export type Workspace = z.infer<typeof WorkspaceSchema>
export type UserSettings = z.infer<typeof UserSettingsSchema>
export type LocalSettings = z.infer<typeof LocalSettingsSchema>
export type SyncMeta = z.infer<typeof SyncMetaSchema>
export type TrashLocation = z.infer<typeof TrashLocationSchema>
export type TrashItem = z.infer<typeof TrashItemSchema>
export type StorageSchema = z.infer<typeof StorageSchemaZod>
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Default values & factories
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  default_view: 'grid',
  open_tab_behavior: 'new_tab',
  save_and_close: false,
  show_favicons: true,
  compact_mode: false,
  active_tabs_on_load: false,
  default_workspace_id: null,
  show_clock: true,
  background: '',
  delete_group_on_open: false,
}

/**
 * New-tab background presets. The id is stored in settings.background;
 * the value is a CSS background (color or gradient). '' = theme default.
 */
export const BACKGROUND_PRESETS: ReadonlyArray<{ id: string; label: string; css: string }> = [
  { id: '', label: 'Default', css: '' },
  { id: 'slate', label: 'Slate', css: '#1e293b' },
  { id: 'warm', label: 'Warm', css: '#fef3c7' },
  { id: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg, #355c7d 0%, #6c5b7b 50%, #c06c84 100%)' },
  { id: 'meadow', label: 'Meadow', css: 'linear-gradient(160deg, #134e5e 0%, #2e8b57 100%)' },
  { id: 'lavender', label: 'Lavender', css: 'linear-gradient(160deg, #e0c3fc 0%, #8ec5fc 100%)' },
]

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  sync_enabled: false,
  sync_interval_minutes: 15,
}

/**
 * Factory — generates a fresh SyncMeta with a unique device_id.
 * Called on install; do not use as a constant (UUID must not be shared).
 */
export function DEFAULT_SYNC_META(): SyncMeta {
  return {
    drive_file_id: null,
    last_sync_at: 0,
    last_modified_at: 0,
    device_id: crypto.randomUUID(),
    sync_state: 'idle',
    pending_sync: false,
    error_message: null,
    retry_count: 0,
  }
}

/**
 * Factory — always call this rather than constructing a Workspace literal,
 * so IDs are genuinely unique at runtime.
 */
export function DEFAULT_WORKSPACE(): Workspace {
  const now = Date.now()
  const categoryId = crypto.randomUUID()

  return {
    id: crypto.randomUUID(),
    name: 'My Workspace',
    created_at: now,
    categories: [
      {
        id: categoryId,
        name: 'General',
        color: '#6366f1',
        emoji: '📁',
        collapsed: false,
        notes: [],
        order: 0,
        groups: [],
      },
    ],
  }
}
