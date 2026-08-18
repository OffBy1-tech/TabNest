import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type UserSettings } from './schema'
import { workspace, category, group, trashItem } from './testFixtures'
import { planSync } from './syncPlan'

const settings = (o: Partial<UserSettings> = {}): UserSettings => ({ ...DEFAULT_SETTINGS, ...o })

type Side = Parameters<typeof planSync>[0]

const side = (o: Partial<Side> = {}): Side => ({
  workspaces: [],
  settings: settings(),
  trash: [],
  sync_meta: { last_modified_at: 0 },
  ...o,
})

describe('planSync', () => {
  it('pushes local as-is when Drive has no file yet', () => {
    const plan = planSync(side({ workspaces: [workspace('ws-a')] }), null)
    expect(plan).toEqual({ backupFirst: false, write: null, push: true, adoptRemoteModifiedAt: null })
  })

  it('honors a concurrent remote deletion even when local was modified more recently (smoke-test bug)', () => {
    // Machine A deleted group G (tombstone at t=60) and pushed. Machine B still
    // has G (last touched t=40) and then created a new workspace at t=70, so
    // B's last_modified_at outranks remote's. The old "local wins" branch
    // blind-pushed B's state, resurrecting G on Drive and wiping the tombstone.
    const g = group('g1', { updated_at: 40 })
    const local = side({
      workspaces: [
        workspace('ws-default', [category('cat-default', { groups: [g] })]),
        workspace('ws-new', [category('cat-new')], { updated_at: 70 }),
      ],
      sync_meta: { last_modified_at: 70 },
    })
    const remote = side({
      workspaces: [workspace('ws-default', [category('cat-default')])],
      trash: [trashItem('t2', { type: 'group', data: { id: 'g1' }, deleted_at: 60 })],
      sync_meta: { last_modified_at: 60 },
    })

    const plan = planSync(local, remote)

    expect(plan.write).not.toBeNull()
    const groups = plan.write!.workspaces.flatMap((w) => w.categories.flatMap((c) => c.groups))
    expect(groups.map((x) => x.id)).not.toContain('g1') // deletion applied locally
    expect(plan.write!.workspaces.map((w) => w.id)).toContain('ws-new') // local-only data kept
    expect(plan.write!.trash.some((t) => t.id === 't2')).toBe(true) // tombstone retained
    expect(plan.push).toBe(true) // merged state (with B's additions) goes back to Drive
    expect(plan.backupFirst).toBe(true) // merge changes local workspaces — snapshot first
  })

  it('does nothing when local and remote are already identical', () => {
    const ws = [workspace('ws-a', [category('cat', { groups: [group('g1')] })])]
    const plan = planSync(
      side({ workspaces: ws, sync_meta: { last_modified_at: 50 } }),
      side({ workspaces: ws, sync_meta: { last_modified_at: 50 } }),
    )
    expect(plan).toEqual({ backupFirst: false, write: null, push: false, adoptRemoteModifiedAt: null })
  })

  it('adopts remote changes without pushing back when local contributed nothing', () => {
    const ws = [workspace('ws-a', [category('cat', { groups: [group('g1')] })])]
    const plan = planSync(
      side({ workspaces: [workspace('ws-a', [category('cat')])], sync_meta: { last_modified_at: 10 } }),
      side({ workspaces: ws, sync_meta: { last_modified_at: 50 } }),
    )
    expect(plan.write).not.toBeNull()
    expect(plan.write!.workspaces).toEqual(ws)
    expect(plan.push).toBe(false)
    expect(plan.adoptRemoteModifiedAt).toBe(50)
    expect(plan.backupFirst).toBe(true)
  })

  it('pushes local-only content changes without rewriting local storage', () => {
    const plan = planSync(
      side({
        workspaces: [workspace('ws-a', [category('cat', { groups: [group('g1')] })])],
        sync_meta: { last_modified_at: 50 },
      }),
      side({ workspaces: [workspace('ws-a', [category('cat')])], sync_meta: { last_modified_at: 10 } }),
    )
    expect(plan.write).toBeNull()
    expect(plan.push).toBe(true)
    expect(plan.backupFirst).toBe(false)
  })

  it('pushes a local settings change even when workspaces and trash match remote', () => {
    const ws = [workspace('ws-a')]
    const plan = planSync(
      side({ workspaces: ws, settings: settings({ theme: 'dark' }), sync_meta: { last_modified_at: 50 } }),
      side({ workspaces: ws, settings: settings({ theme: 'light' }), sync_meta: { last_modified_at: 10 } }),
    )
    expect(plan.write).toBeNull() // local already holds the winning settings
    expect(plan.push).toBe(true)
  })

  it('adopts newer remote settings last-write-wins', () => {
    const ws = [workspace('ws-a')]
    const plan = planSync(
      side({ workspaces: ws, settings: settings({ theme: 'dark' }), sync_meta: { last_modified_at: 10 } }),
      side({ workspaces: ws, settings: settings({ theme: 'light' }), sync_meta: { last_modified_at: 50 } }),
    )
    expect(plan.write).not.toBeNull()
    expect(plan.write!.settings.theme).toBe('light')
    expect(plan.push).toBe(false)
    expect(plan.adoptRemoteModifiedAt).toBe(50)
  })

  it('unions both sides on divergence and pushes the merged result', () => {
    const plan = planSync(
      side({
        workspaces: [workspace('ws-a', [category('cat-a')])],
        sync_meta: { last_modified_at: 50 },
      }),
      side({
        workspaces: [workspace('ws-b', [category('cat-b')])],
        sync_meta: { last_modified_at: 40 },
      }),
    )
    expect(plan.write).not.toBeNull()
    expect(plan.write!.workspaces.map((w) => w.id).sort()).toEqual(['ws-a', 'ws-b'])
    expect(plan.push).toBe(true)
    expect(plan.backupFirst).toBe(true)
  })
})
