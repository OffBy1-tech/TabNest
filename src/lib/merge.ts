/**
 * First-connect merge helpers (spec §9.2).
 *
 * Union local and remote by entity ID at each level of the hierarchy.
 * Entities that exist on only one side are kept as-is. Entities that exist on
 * both sides are merged: workspaces and categories recurse downward and union
 * their leaf content by id; a group present on both sides keeps the newer copy's
 * scalar metadata but UNIONs its tabs and notes by id — so neither device loses
 * saved tabs, notes, or standalone category notes. Order fields are renumbered
 * after merging so there are no gaps or duplicates.
 *
 * Pure functions, extracted from the service worker so they can be unit-tested
 * without the SW's import-time side effects.
 */

import type { Workspace, Category, TabGroup, TrashItem } from './schema'

/** Concatenate two id-bearing lists, dropping secondary entries whose id is already present in primary. */
export function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set(primary.map((x) => x.id))
  return [...primary, ...secondary.filter((x) => !seen.has(x.id))]
}

export function mergeWorkspaces(local: Workspace[], remote: Workspace[]): Workspace[] {
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

export function mergeCategories(local: Category[], remote: Category[]): Category[] {
  const localById = new Map(local.map((c) => [c.id, c]))
  const remoteById = new Map(remote.map((c) => [c.id, c]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    // Category on both sides — recurse into groups, and union standalone
    // category notes by id so neither device's notes are dropped. (Categories
    // have no updated_at, so remote wins the scalar fields via the spread.)
    if (l && r) {
      return { ...r, groups: mergeGroups(l.groups, r.groups), notes: unionById(r.notes, l.notes) }
    }
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }))
}

export function mergeGroups(local: TabGroup[], remote: TabGroup[]): TabGroup[] {
  const localById = new Map(local.map((g) => [g.id, g]))
  const remoteById = new Map(remote.map((g) => [g.id, g]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    // Group exists on both sides — same group edited on two devices. Take the
    // newer copy's scalar metadata (name/order/updated_at) but union tabs and
    // notes by id so neither side's saved items are dropped.
    if (l && r) {
      const [newer, older] = l.updated_at >= r.updated_at ? [l, r] : [r, l]
      return { ...newer, tabs: unionById(newer.tabs, older.tabs), notes: unionById(newer.notes, older.notes) }
    }
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((g, i) => ({ ...g, order: i }))
}

export function mergeTrash(local: TrashItem[], remote: TrashItem[]): TrashItem[] {
  const localIds = new Set(local.map((t) => t.id))
  return [...local, ...remote.filter((t) => !localIds.has(t.id))]
}
