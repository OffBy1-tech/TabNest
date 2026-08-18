/**
 * Sync merge helpers (spec §9.2) — run on every sync cycle; planSync
 * (src/lib/syncPlan.ts) decides when the result is written or pushed.
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

/**
 * Order two copies of the same entity newest-first — the single definition of
 * which side wins a scalar conflict, used at every level of the hierarchy.
 *
 * `updated_at` is optional at the workspace and category levels, so legacy data
 * that has never carried one sorts oldest: a device that has since edited an
 * entity outranks a copy that never has. Ties go to `local`, which is safe only
 * because the mutation helpers bump `updated_at` on every content edit — when
 * one forgets, both devices win their own tie and neither converges.
 */
export function newerFirst<T extends { updated_at?: number | undefined }>(
  local: T,
  remote: T,
): [T, T] {
  return (local.updated_at ?? 0) >= (remote.updated_at ?? 0) ? [local, remote] : [remote, local]
}

/**
 * Pure union by id — deletions are NOT honored here, nor are cross-category
 * group duplicates collapsed. Sync callers must go through mergeSyncedState,
 * which composes this with dedupeGroupsAcrossCategories and tombstone
 * suppression.
 */
export function mergeWorkspaces(local: Workspace[], remote: Workspace[]): Workspace[] {
  const localById = new Map(local.map((ws) => [ws.id, ws]))
  const remoteById = new Map(remote.map((ws) => [ws.id, ws]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  return [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    // Workspace on both sides — newer side wins the scalars (name); see newerFirst.
    if (l && r) {
      const [newer] = newerFirst(l, r)
      return { ...newer, categories: mergeCategories(l.categories, r.categories) }
    }
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
    // category notes by id so neither device's notes are dropped. The newer
    // side wins the scalar fields (name/color/emoji); see newerFirst.
    if (l && r) {
      const [newer, older] = newerFirst(l, r)
      return { ...newer, groups: mergeGroups(l.groups, r.groups), notes: unionById(newer.notes, older.notes) }
    }
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }))
}

/**
 * Merge two copies of the same group: the winner keeps the scalar metadata
 * (name/order/updated_at), tabs and notes are unioned by id so neither
 * copy's saved items are dropped. Callers own the winner choice — mergeGroups
 * takes the newer side (local wins ties; same container, no convergence
 * concern), while dedupeGroupsAcrossCategories breaks ties on category id so
 * every device independently picks the same winner.
 */
function mergeGroupPair(winner: TabGroup, loser: TabGroup): TabGroup {
  return {
    ...winner,
    tabs: unionById(winner.tabs, loser.tabs),
    notes: unionById(winner.notes, loser.notes),
  }
}

export function mergeGroups(local: TabGroup[], remote: TabGroup[]): TabGroup[] {
  const localById = new Map(local.map((g) => [g.id, g]))
  const remoteById = new Map(remote.map((g) => [g.id, g]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const merged = [...allIds].map((id) => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    // Group exists on both sides — same group edited on two devices
    if (l && r) {
      const [newer, older] = newerFirst(l, r)
      return mergeGroupPair(newer, older)
    }
    return (l ?? r)!
  })
  return merged.sort((a, b) => a.order - b.order).map((g, i) => ({ ...g, order: i }))
}

export function mergeTrash(local: TrashItem[], remote: TrashItem[]): TrashItem[] {
  const localIds = new Set(local.map((t) => t.id))
  return [...local, ...remote.filter((t) => !localIds.has(t.id))]
}

// ---------------------------------------------------------------------------
// Tombstone suppression (issue #6)
//
// Deletions that go through Trash leave a TrashItem whose `data` holds the
// deleted entity, id included. When merging two devices, an entity whose
// tombstone is NEWER than the entity's own last-touched timestamp was deleted
// after it was last edited — drop it from the union so deletions don't
// resurrect. An entity touched after the tombstone (restoreFromTrash bumps
// updated_at exactly for this) survives the merge.
// ---------------------------------------------------------------------------

/** Entity id → newest tombstone deleted_at across the trash list. */
export function tombstonesFromTrash(trash: TrashItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of trash) {
    const id = (t.data as { id?: unknown } | null | undefined)?.id
    if (typeof id !== 'string') continue
    map.set(id, Math.max(map.get(id) ?? 0, t.deleted_at))
  }
  return map
}

const groupLastTouched = (g: TabGroup): number => g.updated_at
const categoryLastTouched = (c: Category): number =>
  Math.max(
    0,
    c.updated_at ?? 0,
    ...c.groups.map(groupLastTouched),
    ...(c.notes ?? []).map((n) => n.updated_at),
  )
const workspaceLastTouched = (w: Workspace): number =>
  Math.max(w.created_at, w.updated_at ?? 0, ...w.categories.map(categoryLastTouched))

/**
 * Stamp a restored category subtree as touched `at`, so every level outranks
 * its deletion tombstone in applyTombstones (which compares these exact
 * fields: categories/groups/notes → updated_at, tabs → saved_at). Tabs and
 * notes keep their historical timestamps unless `tombstones` (from
 * tombstonesFromTrash) names them — the only case where a bump is needed.
 * Lives next to the lastTouched comparators so the pairing can't drift.
 */
export function stampRestoredCategories(
  categories: Category[],
  at: number,
  tombstones?: Map<string, number>,
): Category[] {
  const bump = (id: string): boolean => tombstones?.has(id) ?? false
  return categories.map((cat) => ({
    ...cat,
    updated_at: at,
    notes: (cat.notes ?? []).map((n) => (bump(n.id) ? { ...n, updated_at: at } : n)),
    groups: cat.groups.map((g) => ({
      ...g,
      updated_at: at,
      tabs: g.tabs.map((t) => (bump(t.id) ? { ...t, saved_at: at } : t)),
      notes: g.notes.map((n) => (bump(n.id) ? { ...n, updated_at: at } : n)),
    })),
  }))
}

/** Remove entities (at every level) whose tombstone postdates their last touch. */
export function applyTombstones(
  workspaces: Workspace[],
  tombstones: Map<string, number>,
): Workspace[] {
  if (tombstones.size === 0) return workspaces // nothing to suppress — skip the tree copy
  const deletedAfter = (id: string, lastTouched: number): boolean =>
    (tombstones.get(id) ?? 0) > lastTouched
  return workspaces
    .filter((ws) => !deletedAfter(ws.id, workspaceLastTouched(ws)))
    .map((ws) => ({
      ...ws,
      categories: ws.categories
        .filter((c) => !deletedAfter(c.id, categoryLastTouched(c)))
        .map((c) => ({
          ...c,
          notes: (c.notes ?? []).filter((n) => !deletedAfter(n.id, n.updated_at)),
          groups: c.groups
            .filter((g) => !deletedAfter(g.id, groupLastTouched(g)))
            .map((g) => ({
              ...g,
              tabs: g.tabs.filter((t) => !deletedAfter(t.id, t.saved_at)),
              notes: g.notes.filter((n) => !deletedAfter(n.id, n.updated_at)),
            })),
        })),
    }))
}

// ---------------------------------------------------------------------------
// Cross-category group dedupe (issue #17)
//
// Union-merge is per container, so a group moved between categories on one
// device gets resurrected in its old category by a stale remote copy and
// appears twice. Group ids are globally unique, so after the union exactly
// one copy of each id may survive: the newer-touched copy wins (a move bumps
// updated_at; a later edit in the old place outranks the move), with ties
// broken by category id so every device converges on the same winner. The
// winner absorbs the losers' tabs/notes (mergeGroupPair) before tombstone
// suppression filters them. Tab moves can't use this mechanism — a tab move
// bumps BOTH parent groups equally, leaving no per-copy recency signal — so
// moveTabBetweenGroups keeps its id-regeneration + hidden-tombstone scheme.
// ---------------------------------------------------------------------------

/** Keep exactly one copy of each group id across all categories. */
export function dedupeGroupsAcrossCategories(workspaces: Workspace[]): Workspace[] {
  // Detection first: the common case has no duplicates and should allocate
  // nothing beyond a Set over the already-existing id strings.
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const ws of workspaces) {
    for (const cat of ws.categories) {
      for (const g of cat.groups) {
        if (seen.has(g.id)) duplicated.add(g.id)
        else seen.add(g.id)
      }
    }
  }
  if (duplicated.size === 0) return workspaces

  // Rare path: collect the duplicated ids' copies and pick each winner.
  const copies = new Map<string, Array<{ catId: string; group: TabGroup }>>()
  for (const ws of workspaces) {
    for (const cat of ws.categories) {
      for (const g of cat.groups) {
        if (!duplicated.has(g.id)) continue
        const list = copies.get(g.id)
        if (list) list.push({ catId: cat.id, group: g })
        else copies.set(g.id, [{ catId: cat.id, group: g }])
      }
    }
  }

  const winners = new Map<string, { catId: string; group: TabGroup }>()
  for (const [id, list] of copies) {
    list.sort((a, b) => b.group.updated_at - a.group.updated_at || (a.catId < b.catId ? -1 : 1))
    const [first, ...losers] = list
    winners.set(id, {
      catId: first!.catId,
      group: losers.reduce((acc, { group }) => mergeGroupPair(acc, group), first!.group),
    })
  }

  // Rebuild: a category is touched iff one of its groups is duplicated —
  // as loser (drop the copy) or winner (swap in the absorbed copy) — and
  // touched categories close their order gaps.
  return workspaces.map((ws) => ({
    ...ws,
    categories: ws.categories.map((cat) => {
      if (!cat.groups.some((g) => duplicated.has(g.id))) return cat
      const kept = cat.groups.flatMap((g) => {
        const winner = winners.get(g.id)
        if (winner == null) return [g]
        return winner.catId === cat.id ? [winner.group] : []
      })
      return { ...cat, groups: kept.map((g, i) => ({ ...g, order: i })) }
    }),
  }))
}

/**
 * Union-merge two devices' synced user data, honoring deletions recorded in
 * either side's trash (issue #6). Applied on every sync cycle via planSync —
 * settings are merged separately (last-write-wins).
 */
export function mergeSyncedState(
  local: { workspaces: Workspace[]; trash: TrashItem[] },
  remote: { workspaces: Workspace[]; trash: TrashItem[] },
): { workspaces: Workspace[]; trash: TrashItem[] } {
  const trash = mergeTrash(local.trash, remote.trash)
  const workspaces = applyTombstones(
    dedupeGroupsAcrossCategories(mergeWorkspaces(local.workspaces, remote.workspaces)),
    tombstonesFromTrash(trash),
  )
  return { workspaces, trash }
}
