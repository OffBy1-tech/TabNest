import { describe, it, expect } from 'vitest'
import {
  SavedTabSchema,
  TabGroupSchema,
  WorkspaceSchema,
  UserSettingsSchema,
  LocalSettingsSchema,
  SyncMetaSchema,
  TrashItemSchema,
  StorageSchemaZod,
  ExtensionMessageSchema,
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_META,
  DEFAULT_WORKSPACE,
  SCHEMA_VERSION,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from './schema'

function validTab() {
  return {
    id: crypto.randomUUID(),
    title: 'Example',
    url: 'https://example.com/',
    saved_at: Date.now(),
  }
}

describe('SavedTabSchema', () => {
  it('accepts a valid tab (favicon and note optional)', () => {
    expect(SavedTabSchema.safeParse(validTab()).success).toBe(true)
    expect(
      SavedTabSchema.safeParse({ ...validTab(), favicon: 'https://example.com/f.ico', note: 'hi' }).success,
    ).toBe(true)
  })

  it('rejects a non-URL url', () => {
    expect(SavedTabSchema.safeParse({ ...validTab(), url: 'not a url' }).success).toBe(false)
  })

  it('rejects a non-UUID id', () => {
    expect(SavedTabSchema.safeParse({ ...validTab(), id: 'tab-1' }).success).toBe(false)
  })

  it('rejects a non-positive saved_at', () => {
    expect(SavedTabSchema.safeParse({ ...validTab(), saved_at: 0 }).success).toBe(false)
  })
})

describe('UserSettingsSchema', () => {
  it('accepts DEFAULT_SETTINGS', () => {
    expect(UserSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })

  it('rejects an unknown theme value', () => {
    expect(UserSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme: 'sepia' }).success).toBe(false)
  })

  it('does not contain per-device sync fields (they belong to LocalSettings)', () => {
    expect(Object.keys(UserSettingsSchema.shape)).not.toContain('sync_enabled')
    expect(Object.keys(UserSettingsSchema.shape)).not.toContain('sync_interval_minutes')
  })
})

describe('LocalSettingsSchema', () => {
  it('accepts DEFAULT_LOCAL_SETTINGS', () => {
    expect(LocalSettingsSchema.safeParse(DEFAULT_LOCAL_SETTINGS).success).toBe(true)
  })

  it('only allows 5, 15, 30, or null as sync interval', () => {
    for (const ok of [5, 15, 30, null]) {
      expect(LocalSettingsSchema.safeParse({ sync_enabled: true, sync_interval_minutes: ok }).success).toBe(true)
    }
    expect(LocalSettingsSchema.safeParse({ sync_enabled: true, sync_interval_minutes: 7 }).success).toBe(false)
  })

  it('bounds sidebar_width to the exported min/max', () => {
    const base = { sync_enabled: false, sync_interval_minutes: 15 as const }
    expect(LocalSettingsSchema.safeParse({ ...base, sidebar_width: SIDEBAR_WIDTH_MIN }).success).toBe(true)
    expect(LocalSettingsSchema.safeParse({ ...base, sidebar_width: SIDEBAR_WIDTH_MAX }).success).toBe(true)
    expect(LocalSettingsSchema.safeParse({ ...base, sidebar_width: SIDEBAR_WIDTH_MIN - 1 }).success).toBe(false)
    expect(LocalSettingsSchema.safeParse({ ...base, sidebar_width: SIDEBAR_WIDTH_MAX + 1 }).success).toBe(false)
  })
})

describe('StorageSchemaZod', () => {
  function validStorage() {
    return {
      schema_version: SCHEMA_VERSION,
      workspaces: [DEFAULT_WORKSPACE()],
      settings: DEFAULT_SETTINGS,
      local_settings: DEFAULT_LOCAL_SETTINGS,
      sync_meta: DEFAULT_SYNC_META(),
      trash: [],
    }
  }

  it('accepts a full valid document', () => {
    expect(StorageSchemaZod.safeParse(validStorage()).success).toBe(true)
  })

  it('defaults local_settings when absent (Drive-sourced data has none)', () => {
    const driveShaped: Record<string, unknown> = { ...validStorage() }
    delete driveShaped['local_settings']
    const parsed = StorageSchemaZod.parse(driveShaped)
    expect(parsed.local_settings).toEqual({ sync_enabled: false, sync_interval_minutes: 15 })
  })

  it('rejects a document with an invalid workspace', () => {
    const doc = validStorage()
    doc.workspaces[0]!.id = 'not-a-uuid'
    expect(StorageSchemaZod.safeParse(doc).success).toBe(false)
  })
})

describe('TrashItemSchema', () => {
  it('accepts arbitrary data payloads (validated contextually on restore)', () => {
    const item = {
      id: crypto.randomUUID(),
      type: 'group',
      data: { anything: true },
      original_location: { workspace_id: crypto.randomUUID() },
      deleted_at: Date.now(),
    }
    expect(TrashItemSchema.safeParse(item).success).toBe(true)
  })
})

describe('ExtensionMessageSchema', () => {
  it('accepts a valid SAVE_TABS message', () => {
    const msg = {
      type: 'SAVE_TABS',
      payload: {
        tabs: [validTab()],
        group_name: 'My Group',
        category_id: crypto.randomUUID(),
        workspace_id: crypto.randomUUID(),
      },
    }
    expect(ExtensionMessageSchema.safeParse(msg).success).toBe(true)
  })

  it('accepts payload-less message types', () => {
    for (const type of ['GET_ALL_DATA', 'TRIGGER_SYNC', 'CONNECT_DRIVE', 'DISCONNECT_DRIVE', 'GET_SYNC_STATUS']) {
      expect(ExtensionMessageSchema.safeParse({ type }).success).toBe(true)
    }
  })

  it('rejects an unknown message type', () => {
    expect(ExtensionMessageSchema.safeParse({ type: 'LAUNCH_MISSILES' }).success).toBe(false)
  })

  it('rejects DELETE_GROUP with a malformed payload', () => {
    const msg = { type: 'DELETE_GROUP', payload: { group_id: 'nope' } }
    expect(ExtensionMessageSchema.safeParse(msg).success).toBe(false)
  })
})

describe('default factories', () => {
  it('DEFAULT_SYNC_META generates a valid SyncMeta with a unique device_id per call', () => {
    const a = DEFAULT_SYNC_META()
    const b = DEFAULT_SYNC_META()
    expect(SyncMetaSchema.safeParse(a).success).toBe(true)
    expect(a.device_id).not.toBe(b.device_id)
  })

  it('DEFAULT_WORKSPACE generates a valid workspace with unique ids per call', () => {
    const a = DEFAULT_WORKSPACE()
    const b = DEFAULT_WORKSPACE()
    expect(WorkspaceSchema.safeParse(a).success).toBe(true)
    expect(a.id).not.toBe(b.id)
    expect(a.categories[0]!.id).not.toBe(b.categories[0]!.id)
  })

  it('DEFAULT_WORKSPACE starts with a single empty "General" category', () => {
    const ws = DEFAULT_WORKSPACE()
    expect(ws.categories).toHaveLength(1)
    expect(ws.categories[0]!.name).toBe('General')
    expect(ws.categories[0]!.groups).toEqual([])
    expect(TabGroupSchema.array().safeParse(ws.categories[0]!.groups).success).toBe(true)
  })
})
