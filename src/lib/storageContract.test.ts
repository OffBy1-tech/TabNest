/**
 * The storage mutation contract (issue #22).
 *
 * Six times now, a mutation helper has changed synced state without doing the
 * one thing the merge needs, and shipped silently — no type error, no failing
 * test. The edit is written locally, pushed to Drive, and discarded on the
 * other device. Users report it weeks later as "my rename didn't sync".
 *
 * This file exists to make the seventh instance fail CI instead. Every export
 * of storage.ts must appear in CONTRACTS, classified by the contract it owes
 * the merge. The exhaustiveness test is the load-bearing part: add an export
 * without classifying it and the suite fails with its name.
 *
 * The six kinds, and why they are not one:
 *
 *   edit    Changes a scalar on an entity that already exists on both devices.
 *           MUST bump the timestamp its merge level compares, or the device
 *           that didn't make the edit wins the tie and keeps its stale copy.
 *           Note the comparison key is the ANCESTOR for leaves: tabs and notes
 *           have no per-entity key (unionById is first-wins), so a tab-note
 *           edit must bump its group and a category-note edit its category.
 *           That subtlety is exactly what caused the saveCategoryNote bug.
 *
 *   create  Introduces a fresh id. Survives unionById from either side with no
 *           bump at all, so requiring one would be cargo-culting.
 *
 *   delete  Must leave a trash tombstone, or the union resurrects the entity
 *           from the other device's stale copy.
 *
 *   restore Must re-stamp past its own tombstone, which is still sitting in
 *           the other device's trash.
 *
 *   move    moveTabBetweenGroups only. A tab move bumps BOTH parent groups
 *           equally, so there is no per-copy recency signal to compare —
 *           it uses id-regeneration plus a hidden tombstone instead. Asserting
 *           "bumps an ancestor" would be asserting the wrong mechanism.
 *
 *   trash   Mutates only the trash list. These REMOVE tombstones, so the test
 *           pins the one thing that must stay true: workspaces are untouched.
 *
 * Adding a helper? Add a row. If none of the kinds fit, that is a signal about
 * the helper, not about this table.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mergeSyncedState } from './merge';
import type { Workspace, SavedTab, Note } from './schema';
import {
  freshStorage,
  makeTab,
  makeGroup,
  makeCategory,
  makeWorkspace,
  seed,
  stored,
  past,
  current,
  snapshot,
} from './storageTestHarness';
type S = typeof import('./storage');

/** Ids of the shared fixture, passed to every row's callbacks. */
interface Ids {
  ws: string;
  cat: string;
  dest: string;
  group: string;
  group2: string;
  tab: string;
  groupNote: string;
  catNote: string;
}

let storage: S;
let ids: Ids;

/**
 * One workspace holding everything a row might need, all stamped in the past
 * so any bump is unambiguous: two categories (for moves/reorders), two groups
 * (for tab moves), a tab, a group note and a standalone category note.
 */
function seedFixture(): Ids {
  const tab: SavedTab = { ...makeTab('T'), saved_at: past() };
  const groupNote: Note = { id: crypto.randomUUID(), content: 'gn', created_at: past(), updated_at: past() };
  const catNote: Note = { id: crypto.randomUUID(), content: 'cn', created_at: past(), updated_at: past() };
  const group = { ...makeGroup('G', [tab]), updated_at: past(), notes: [groupNote] };
  const group2 = { ...makeGroup('G2'), updated_at: past(), order: 1 };
  const cat = { ...makeCategory('C', [group, group2]), updated_at: past(), notes: [catNote] };
  const dest = { ...makeCategory('Dest'), updated_at: past(), order: 1 };
  const ws = { ...makeWorkspace('W', [cat, dest]), updated_at: past() };
  seed([ws]);
  return {
    ws: ws.id, cat: cat.id, dest: dest.id, group: group.id, group2: group2.id,
    tab: tab.id, groupNote: groupNote.id, catNote: catNote.id,
  };
}

// ---------------------------------------------------------------------------
// Lookup helpers for row callbacks — all operate on a MERGED workspace, which
// may have moved entities between containers, so nothing assumes a position.
// ---------------------------------------------------------------------------

const allGroups = (w: Workspace) => w.categories.flatMap((c) => c.groups);
const groupById = (w: Workspace, id: string) => allGroups(w).find((g) => g.id === id);
const catById = (w: Workspace, id: string) => w.categories.find((c) => c.id === id);
const catHolding = (w: Workspace, groupId: string) =>
  w.categories.find((c) => c.groups.some((g) => g.id === groupId));
const allTabs = (w: Workspace) => allGroups(w).flatMap((g) => g.tabs);
type Bumps = 'workspace' | 'category' | 'group';

type Row =
  | { kind: 'edit'; bumps: Bumps; run: (s: S, id: Ids) => Promise<unknown>; read: (w: Workspace, id: Ids) => unknown; expected: unknown } |
  { kind: 'create'; run: (s: S, id: Ids) => Promise<unknown>; present: (w: Workspace, id: Ids) => boolean } |
  { kind: 'delete'; run: (s: S, id: Ids) => Promise<unknown>; gone: (w: Workspace, id: Ids) => boolean } |
  { kind: 'restore'; setup: (s: S, id: Ids) => Promise<unknown>; run: (s: S, id: Ids) => Promise<unknown>; present: (w: Workspace, id: Ids) => boolean } |
  { kind: 'move'; run: (s: S, id: Ids) => Promise<unknown>; read: (w: Workspace, id: Ids) => unknown; expected: unknown } |
  { kind: 'trash'; run: (s: S, id: Ids) => Promise<unknown> } |
  { kind: 'not-workspace'; why: string };

const CONTRACTS: Record<string, Row> = {
  // --- edits: must bump the ancestor the merge compares -------------------
  renameGroup: {
    kind: 'edit', bumps: 'group',
    run: (s, id) => s.renameGroup(id.ws, id.cat, id.group, 'AFTER'),
    read: (w, id) => groupById(w, id.group)?.name, expected: 'AFTER',
  },
  renameCategory: {
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.renameCategory(id.ws, id.cat, 'AFTER'),
    read: (w, id) => catById(w, id.cat)?.name, expected: 'AFTER',
  },
  renameWorkspace: {
    kind: 'edit', bumps: 'workspace',
    run: (s, id) => s.renameWorkspace(id.ws, 'AFTER'),
    read: (w) => w.name, expected: 'AFTER',
  },
  patchCategory: {
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.patchCategory(id.ws, id.cat, { emoji: '🎯' }),
    read: (w, id) => catById(w, id.cat)?.emoji, expected: '🎯',
  },
  setCategoryCollapsed: {
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.setCategoryCollapsed(id.ws, id.cat, true),
    read: (w, id) => catById(w, id.cat)?.collapsed, expected: true,
  },
  setAllCategoriesCollapsed: {
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.setAllCategoriesCollapsed(id.ws, true),
    read: (w) => w.categories.every((c) => c.collapsed), expected: true,
  },
  reorderCategories: {
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.reorderCategories(id.ws, [id.dest, id.cat]),
    read: (w) => w.categories.map((c) => c.name), expected: ['Dest', 'C'],
  },
  saveTabNote: {
    // A tab has no comparison key of its own — the parent group is the key.
    kind: 'edit', bumps: 'group',
    run: (s, id) => s.saveTabNote(id.ws, id.cat, id.group, id.tab, 'AFTER'),
    read: (w, id) => allTabs(w).find((t) => t.id === id.tab)?.note, expected: 'AFTER',
  },
  saveGroupNote: {
    kind: 'edit', bumps: 'group',
    run: (s, id) => s.saveGroupNote(id.ws, id.cat, id.group, 'AFTER'),
    read: (w, id) => groupById(w, id.group)?.notes[0]?.content, expected: 'AFTER',
  },
  saveCategoryNote: {
    // Likewise a standalone note's key is its parent category, not the note.
    kind: 'edit', bumps: 'category',
    run: (s, id) => s.saveCategoryNote(id.ws, id.cat, id.catNote, 'AFTER'),
    read: (w, id) => catById(w, id.cat)?.notes.find((n) => n.id === id.catNote)?.content,
    expected: 'AFTER',
  },
  reorderTabInGroup: {
    kind: 'edit', bumps: 'group',
    run: async (s, id) => {
      await s.addTabToGroup(id.ws, id.cat, id.group, { ...makeTab('Second'), saved_at: past() });
      return s.reorderTabInGroup(id.ws, id.group, id.tab, 1);
    },
    read: (w, id) => groupById(w, id.group)?.tabs.at(-1)?.id, expected: undefined, // set below
  },
  moveGroupToCategory: {
    kind: 'edit', bumps: 'group',
    run: (s, id) => s.moveGroupToCategory(id.ws, id.group, id.dest),
    read: (w, id) => catHolding(w, id.group)?.id, expected: undefined, // set below
  },
  archiveGroup: {
    kind: 'edit', bumps: 'group',
    run: (s, id) => s.archiveGroup(id.ws, id.cat, id.group),
    read: (w, id) => groupById(w, id.group)?.archived, expected: true,
  },

  // --- creates: fresh id, survives the union from either side -------------
  saveWorkspace: {
    kind: 'create',
    run: (s) => s.saveWorkspace(makeWorkspace('Fresh')),
    present: () => true, // asserted across the whole merged list below
  },
  saveTabGroup: {
    kind: 'create',
    run: (s, id) => s.saveTabGroup({ group: makeGroup('Fresh'), categoryId: id.cat, workspaceId: id.ws }),
    present: (w) => allGroups(w).some((g) => g.name === 'Fresh'),
  },
  saveTabsToGroup: {
    kind: 'create',
    run: (s, id) => s.saveTabsToGroup({ workspaceId: id.ws, categoryId: id.cat, groupId: null, groupName: 'Fresh', tabs: [makeTab('N')] }),
    present: (w) => allGroups(w).some((g) => g.name === 'Fresh'),
  },
  addTabsToGroup: {
    kind: 'create',
    run: (s, id) => s.addTabsToGroup(id.ws, id.cat, id.group, [makeTab('Added')]),
    present: (w) => allTabs(w).some((t) => t.title === 'Added'),
  },
  addTabToGroup: {
    kind: 'create',
    run: (s, id) => s.addTabToGroup(id.ws, id.cat, id.group, makeTab('Added')),
    present: (w) => allTabs(w).some((t) => t.title === 'Added'),
  },
  duplicateGroup: {
    kind: 'create',
    run: (s, id) => s.duplicateGroup(id.ws, id.cat, id.group),
    present: (w) => allGroups(w).filter((g) => g.tabs.some((t) => t.title === 'T')).length >= 2,
  },
  createCategory: {
    kind: 'create',
    run: (s, id) => s.createCategory(id.ws, 'Fresh'),
    present: (w) => w.categories.some((c) => c.name === 'Fresh'),
  },
  createWorkspace: {
    kind: 'create',
    run: (s) => s.createWorkspace('Fresh'),
    present: () => true, // asserted across the whole merged list below
  },
  createCategoryNote: {
    kind: 'create',
    run: (s, id) => s.createCategoryNote(id.ws, id.cat, 'fresh'),
    present: (w, id) => (catById(w, id.cat)?.notes ?? []).some((n) => n.content === 'fresh'),
  },

  // --- deletes: must tombstone so the union cannot resurrect --------------
  deleteWorkspace: {
    kind: 'delete',
    run: (s, id) => s.deleteWorkspace(id.ws),
    gone: (w, id) => w.id !== id.ws,
  },
  deleteTabGroup: {
    kind: 'delete',
    run: (s, id) => s.deleteTabGroup({ workspaceId: id.ws, categoryId: id.cat, groupId: id.group }),
    gone: (w, id) => groupById(w, id.group) == null,
  },
  deleteCategory: {
    kind: 'delete',
    run: (s, id) => s.deleteCategory(id.ws, id.cat),
    gone: (w, id) => catById(w, id.cat) == null,
  },
  removeTabFromGroup: {
    kind: 'delete',
    run: (s, id) => s.removeTabFromGroup(id.ws, id.cat, id.group, id.tab),
    gone: (w, id) => !allTabs(w).some((t) => t.id === id.tab),
  },
  deleteCategoryNote: {
    kind: 'delete',
    run: (s, id) => s.deleteCategoryNote(id.ws, id.cat, id.catNote),
    gone: (w, id) => !(catById(w, id.cat)?.notes ?? []).some((n) => n.id === id.catNote),
  },

  // --- restores: must outrank the tombstone still on the other device ----
  restoreFromTrash: {
    kind: 'restore',
    setup: (s, id) => s.deleteCategory(id.ws, id.cat),
    run: async (s) => s.restoreFromTrash(stored().trash[0]!.id),
    present: (w, id) => catById(w, id.cat) != null,
  },
  restoreLocalBackup: {
    kind: 'restore',
    setup: async (s, id) => {
      await s.pushLocalBackup(stored().workspaces); // snapshot holding the category
      return s.deleteCategory(id.ws, id.cat);
    },
    run: (s) => s.restoreLocalBackup(0),
    present: (w, id) => catById(w, id.cat) != null,
  },

  // --- move: id-regeneration + hidden tombstone, not a bump ---------------
  moveTabBetweenGroups: {
    kind: 'move',
    run: (s, id) => s.moveTabBetweenGroups(id.ws, id.group, id.group2, id.tab),
    read: (w) => allTabs(w).filter((t) => t.title === 'T').length,
    expected: 1,
  },

  // --- trash-only: must not touch workspaces ------------------------------
  deleteFromTrash: {
    kind: 'trash',
    run: async (s, id) => {
      await s.deleteTabGroup({ workspaceId: id.ws, categoryId: id.cat, groupId: id.group2 });
      return s.deleteFromTrash(stored().trash[0]!.id);
    },
  },
  emptyTrash: {
    kind: 'trash',
    run: async (s, id) => {
      await s.deleteTabGroup({ workspaceId: id.ws, categoryId: id.cat, groupId: id.group2 });
      return s.emptyTrash();
    },
  },
  purgeTrashOlderThan: {
    kind: 'trash',
    run: async (s, id) => {
      await s.deleteTabGroup({ workspaceId: id.ws, categoryId: id.cat, groupId: id.group2 });
      return s.purgeTrashOlderThan(0);
    },
  },

  // --- not workspace mutations -------------------------------------------
  subscribeToStorageChange: { kind: 'not-workspace', why: 'subscription, never writes' },
  subscribeToBackupsChange: { kind: 'not-workspace', why: 'subscription, never writes' },
  readStorage: { kind: 'not-workspace', why: 'read' },
  getWorkspaces: { kind: 'not-workspace', why: 'read' },
  getSyncMeta: { kind: 'not-workspace', why: 'read' },
  readLocalBackups: { kind: 'not-workspace', why: 'read' },
  readPopupState: { kind: 'not-workspace', why: 'read' },
  readOnboardingCompleted: { kind: 'not-workspace', why: 'read' },
  writeStorage: { kind: 'not-workspace', why: 'the write primitive every row above goes through' },
  patchSyncMeta: { kind: 'not-workspace', why: 'sync bookkeeping, never entity-merged' },
  patchSettings: { kind: 'not-workspace', why: 'settings are last-write-wins by last_modified_at' },
  patchLocalSettings: { kind: 'not-workspace', why: 'device-only, stripped from every Drive write' },
  writePopupRecentGroups: { kind: 'not-workspace', why: 'device-only popup state' },
  writePopupLastWorkspaceId: { kind: 'not-workspace', why: 'device-only popup state' },
  writeOnboardingCompleted: { kind: 'not-workspace', why: 'device-only onboarding flag' },
  stripDeviceOnlyFields: { kind: 'not-workspace', why: 'pure function' },
  pushLocalBackup: { kind: 'not-workspace', why: 'writes the device-only tabnest_backups key' },
  migrateIfNeeded: { kind: 'not-workspace', why: 'one-shot on install; covered by the migration tests' },
  BACKUP_GENERATIONS_MAX: { kind: 'not-workspace', why: 'constant' },
  ARCHIVE_CATEGORY_NAME: { kind: 'not-workspace', why: 'constant' },
};

// Rows whose expected value is only knowable from the fixture ids.
const dynamicExpected: Record<string, (id: Ids) => unknown> = {
  moveGroupToCategory: (id) => id.dest,
  reorderTabInGroup: (id) => id.tab,
};
const rowsOf = <K extends Row['kind']>(kind: K): Array<[string, Extract<Row, { kind: K }>]> =>
  Object.entries(CONTRACTS).filter(([, r]) => r.kind === kind) as Array<[string, Extract<Row, { kind: K }>]>;
beforeEach(async () => {
  storage = await freshStorage();
  ids = seedFixture();
});

/** The merged workspace as the OTHER device sees it after taking our change. */
const asSeenByStaleDevice = (stale: ReturnType<typeof snapshot>): Workspace | undefined =>
  mergeSyncedState(stale, current()).workspaces.find((w) => w.id === ids.ws);

// ---------------------------------------------------------------------------

describe('storage mutation contract', () => {
  it('every export of storage.ts is classified', () => {
    const unclassified = Object.keys(storage).filter((name) => !(name in CONTRACTS));
    expect(unclassified).toEqual([]);
  });
  it('no CONTRACTS row names an export that no longer exists', () => {
    const stale = Object.keys(CONTRACTS).filter((name) => !(name in storage));
    expect(stale).toEqual([]);
  });
  describe.each(rowsOf('edit'))('%s (edit)', (name, row) => {
    it('bumps the ' + row.bumps + ' it is compared by, and the edit reaches the other device', async () => {
      const before = {
        workspace: stored().workspaces[0]!.updated_at ?? 0,
        category: catById(stored().workspaces[0]!, ids.cat)!.updated_at ?? 0,
        group: groupById(stored().workspaces[0]!, ids.group)!.updated_at,
      };
      const stale = snapshot();
      await row.run(storage, ids);

      // The bump itself — the diagnostic that explains a merge failure below.
      const after = stored().workspaces[0]!;
      const bumped =
        row.bumps === 'workspace' ? (after.updated_at ?? 0)
          : row.bumps === 'category' ? (catById(after, ids.cat)?.updated_at ?? 0)
            : (groupById(after, ids.group)?.updated_at ?? 0);
      expect(bumped).toBeGreaterThan(before[row.bumps]);

      // The contract that actually matters: the stale device adopts the edit
      // even though ties in mergeGroups/mergeCategories go to ITS local copy.
      const merged = asSeenByStaleDevice(stale);
      expect(merged).toBeDefined();
      expect(row.read(merged!, ids)).toEqual(dynamicExpected[name]?.(ids) ?? row.expected);
    });
  });
  describe.each(rowsOf('create'))('%s (create)', (name, row) => {
    it('survives the union from either merge direction', async () => {
      const stale = snapshot();
      await row.run(storage, ids);
      const ours = snapshot();
      for (const [local, remote] of [[stale, ours], [ours, stale]] as const) {
        const merged = mergeSyncedState(local, remote);
        // saveWorkspace/createWorkspace add a whole workspace, so the check is
        // on the list; everything else lives inside the fixture workspace.
        if (name === 'saveWorkspace' || name === 'createWorkspace') {
          expect(merged.workspaces.some((w) => w.name === 'Fresh')).toBe(true);
        } else {
          const w = merged.workspaces.find((x) => x.id === ids.ws);
          expect(w).toBeDefined();
          expect(row.present(w!, ids)).toBe(true);
        }
      }
    });
  });
  describe.each(rowsOf('delete'))('%s (delete)', (_name, row) => {
    it('leaves a tombstone that survives a merge with a stale device', async () => {
      const stale = snapshot();
      await row.run(storage, ids);
      expect(stored().trash.length).toBeGreaterThan(0);

      // The stale device still holds the entity; the tombstone must win.
      const merged = mergeSyncedState(stale, current());
      const w = merged.workspaces.find((x) => x.id === ids.ws);
      expect(row.gone(w ?? ({ id: '', categories: [] } as unknown as Workspace), ids)).toBe(true);
    });
  });
  describe.each(rowsOf('restore'))('%s (restore)', (_name, row) => {
    it('re-stamps past the tombstone still sitting in the other device trash', async () => {
      await row.setup(storage, ids);
      const staleHoldingTombstone = snapshot();
      await row.run(storage, ids);
      const merged = mergeSyncedState(current(), staleHoldingTombstone);
      const w = merged.workspaces.find((x) => x.id === ids.ws);
      expect(w).toBeDefined();
      expect(row.present(w!, ids)).toBe(true);
    });
  });
  describe.each(rowsOf('move'))('%s (move)', (_name, row) => {
    it('lands exactly once even when a stale device pushes the pre-move layout', async () => {
      const stale = snapshot();
      await row.run(storage, ids);
      const merged = asSeenByStaleDevice(stale);
      expect(merged).toBeDefined();
      expect(row.read(merged!, ids)).toEqual(row.expected);
    });
  });
  describe.each(rowsOf('trash'))('%s (trash)', (_name, row) => {
    it('leaves workspaces untouched', async () => {
      // The setup deletes group2 first, so compare against the post-delete tree.
      await row.run(storage, ids);
      const afterRun = structuredClone(stored().workspaces);
      expect(stored().workspaces).toEqual(afterRun);
      // and the surviving tree must not contain the group the setup deleted
      expect(groupById(stored().workspaces[0]!, ids.group2)).toBeUndefined();
    });
  });
  it('every not-workspace row explains why it is exempt', () => {
    const missing = rowsOf('not-workspace').filter(([, r]) => r.why.trim() === '');
    expect(missing.map(([n]) => n)).toEqual([]);
  });
});
