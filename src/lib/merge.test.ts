import { describe, expect, it } from 'vitest';
import {
  unionById,
  mergeGroups,
  mergeCategories,
  mergeWorkspaces,
  mergeTrash,
  tombstonesFromTrash,
  applyTombstones,
  mergeSyncedState,
} from './merge';
import type { TrashItem, Workspace } from './schema';
import { tab, note, group, category, workspace, trashItem as trash } from './testFixtures';

describe('unionById', () => {
  it('concatenates and dedupes by id, keeping the primary copy', () => {
    const a1 = { id: 'a', v: 1 };
    const a2 = { id: 'a', v: 2 };
    const b = { id: 'b', v: 3 };
    const c = { id: 'c', v: 4 };
    const out = unionById([a1, b], [a2, c]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(out.find((x) => x.id === 'a')).toBe(a1); // primary wins
  });
});

describe('mergeGroups', () => {
  it('unions tabs and notes of a group present on both sides (no data loss)', () => {
    const local = [group('g1', { updated_at: 2, tabs: [tab('t1')], notes: [note('n1')] })];
    const remote = [group('g1', { updated_at: 1, name: 'stale', tabs: [tab('t2')], notes: [note('n2')] })];

    const [merged] = mergeGroups(local, remote);
    expect(merged!.name).toBe('g1'); // newer (local) scalar metadata wins
    expect(merged!.tabs.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(merged!.notes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });

  it('takes the newer side scalar when remote is newer, still unioning leaves', () => {
    const local = [group('g1', { updated_at: 1, name: 'old', tabs: [tab('t1')] })];
    const remote = [group('g1', { updated_at: 5, name: 'new', tabs: [tab('t2')] })];
    const [merged] = mergeGroups(local, remote);
    expect(merged!.name).toBe('new');
    expect(merged!.tabs.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('keeps groups that exist on only one side and renumbers order', () => {
    const merged = mergeGroups([group('a', { order: 5 })], [group('b', { order: 9 })]);
    expect(merged.map((g) => g.id).sort()).toEqual(['a', 'b']);
    expect(merged.map((g) => g.order).sort()).toEqual([0, 1]);
  });
});

describe('mergeCategories', () => {
  it('unions standalone category notes so neither device loses them', () => {
    const local = [category('c1', { notes: [note('ln')], groups: [group('gl')] })];
    const remote = [category('c1', { notes: [note('rn')], groups: [group('gr')] })];

    const [merged] = mergeCategories(local, remote);
    expect(merged!.notes.map((n) => n.id).sort()).toEqual(['ln', 'rn']);
    // groups from both sides survive the recursive merge too
    expect(merged!.groups.map((g) => g.id).sort()).toEqual(['gl', 'gr']);
  });
});

describe('mergeWorkspaces', () => {
  it('recursively unions down to group tabs across a shared workspace', () => {
    const local = [workspace('w', [category('c', { groups: [group('g', { updated_at: 1, tabs: [tab('t1')] })] })])];
    const remote = [workspace('w', [category('c', { groups: [group('g', { updated_at: 2, tabs: [tab('t2')] })] })])];

    const [ws] = mergeWorkspaces(local, remote);
    const tabs = ws!.categories[0]!.groups[0]!.tabs;
    expect(tabs.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('keeps workspaces unique to one side', () => {
    const out = mergeWorkspaces([workspace('a', [])], [workspace('b', [])]);
    expect(out.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the newer side scalars, mirroring categories and groups', () => {
    const local = [workspace('w', [], { name: 'Local', updated_at: 2 })];
    const remote = [workspace('w', [], { name: 'Remote', updated_at: 1 })];
    expect(mergeWorkspaces(local, remote)[0]!.name).toBe('Local');
    expect(mergeWorkspaces(remote, local)[0]!.name).toBe('Local');
  });

  it('breaks ties in favor of local, and treats a missing updated_at as oldest', () => {
    const untimed = [workspace('w', [], { name: 'Legacy' })];
    const timed = [workspace('w', [], { name: 'Renamed', updated_at: 1 })];
    // A renamed side outranks legacy data that has never carried a timestamp
    expect(mergeWorkspaces(untimed, timed)[0]!.name).toBe('Renamed');
    expect(mergeWorkspaces(timed, untimed)[0]!.name).toBe('Renamed');
    // Equal timestamps — local wins, as in mergeGroups/mergeCategories
    const other = [workspace('w', [], { name: 'Other', updated_at: 1 })];
    expect(mergeWorkspaces(timed, other)[0]!.name).toBe('Renamed');
  });
});

describe('mergeTrash', () => {
  it('unions by id without duplicating shared entries', () => {
    const out = mergeTrash([trash('x')], [trash('x'), trash('y')]);
    expect(out.map((t) => t.id).sort()).toEqual(['x', 'y']);
  });
});

// Tombstone: a trash item whose data carries the deleted entity's id.
const tombstone = (entityId: string, deletedAt: number): TrashItem => ({
  id: `trash-${entityId}`,
  type: 'group',
  data: { id: entityId },
  original_location: { workspace_id: 'ws' },
  deleted_at: deletedAt,
});

describe('tombstonesFromTrash', () => {
  it('maps entity ids to their newest deleted_at and ignores items without an id', () => {
    const map = tombstonesFromTrash([
      tombstone('g1', 5),
      tombstone('g1', 9),
      { ...tombstone('junk', 3), data: null },
    ]);
    expect(map.get('g1')).toBe(9);
    expect(map.size).toBe(1);
  });
});

describe('applyTombstones', () => {
  it('drops a group whose tombstone is newer than its updated_at', () => {
    const ws = workspace('w', [category('c', { groups: [group('g', { updated_at: 10 })] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('g', 20)]));
    expect(out[0]!.categories[0]!.groups).toHaveLength(0);
  });

  it('keeps a group touched after the tombstone (restored or edited post-delete)', () => {
    const ws = workspace('w', [category('c', { groups: [group('g', { updated_at: 30 })] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('g', 20)]));
    expect(out[0]!.categories[0]!.groups).toHaveLength(1);
  });

  it('drops individually tombstoned tabs from surviving groups', () => {
    const g = group('g', { updated_at: 50, tabs: [tab('t1'), tab('t2')] }); // tabs have saved_at 1
    const ws = workspace('w', [category('c', { groups: [g] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('t1', 20)]));
    expect(out[0]!.categories[0]!.groups[0]!.tabs.map((t) => t.id)).toEqual(['t2']);
  });

  it('drops tombstoned categories and workspaces whose contents predate the deletion', () => {
    const wsA = workspace('wA', [category('cA', { groups: [group('gA', { updated_at: 5 })] })]);
    const wsB = workspace('wB', [
      category('cB1', { groups: [group('gB', { updated_at: 5 })] }),
      category('cB2'),
    ]);
    const tombs = tombstonesFromTrash([tombstone('wA', 99), tombstone('cB1', 99)]);
    const out = applyTombstones([wsA, wsB], tombs);
    expect(out.map((w) => w.id)).toEqual(['wB']);
    expect(out[0]!.categories.map((c) => c.id)).toEqual(['cB2']);
  });

  it('leaves untombstoned entities alone', () => {
    const ws = workspace('w', [category('c', { groups: [group('g')] })]);
    expect(applyTombstones([ws], new Map())).toEqual([ws]);
  });
});

describe('mergeSyncedState', () => {
  it('unions workspaces and trash, honoring deletions recorded on either side', () => {
    // Device L deleted group gB (tombstone in its trash) and added gL, which
    // never reached Drive. Device R (remote) still has gB and never saw gL.
    const gL = group('gL', { updated_at: 100 });
    const gB = group('gB', { updated_at: 10 });
    const gShared = group('gS', { updated_at: 10 });
    const local = {
      workspaces: [workspace('w', [category('c', { groups: [gShared, gL] })])],
      trash: [tombstone('gB', 50)],
    };
    const remote = {
      workspaces: [workspace('w', [category('c', { groups: [gShared, gB] })])],
      trash: [] as TrashItem[],
    };
    const merged = mergeSyncedState(local, remote);
    const ids = merged.workspaces[0]!.categories[0]!.groups.map((g) => g.id).sort();
    expect(ids).toEqual(['gL', 'gS']); // gL preserved, gB deletion propagated
    expect(merged.trash.map((t) => t.id)).toEqual(['trash-gB']);
  });
});

// ---------------------------------------------------------------------------
// Note tombstones + category last-touch (audit F03/F04)
// ---------------------------------------------------------------------------

describe('applyTombstones — notes', () => {
  it('drops tombstoned group notes from surviving groups', () => {
    const g = group('g', { updated_at: 50, notes: [note('n1', { updated_at: 10 }), note('n2', { updated_at: 10 })] });
    const ws = workspace('w', [category('c', { groups: [g] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('n1', 20)]));
    expect(out[0]!.categories[0]!.groups[0]!.notes.map((n) => n.id)).toEqual(['n2']);
  });

  it('keeps a group note edited after its tombstone', () => {
    const g = group('g', { updated_at: 50, notes: [note('n1', { updated_at: 30 })] });
    const ws = workspace('w', [category('c', { groups: [g] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('n1', 20)]));
    expect(out[0]!.categories[0]!.groups[0]!.notes).toHaveLength(1);
  });

  it('drops tombstoned standalone category notes', () => {
    const ws = workspace('w', [category('c', { notes: [note('n1', { updated_at: 10 }), note('n2', { updated_at: 10 })] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('n1', 20)]));
    expect(out[0]!.categories[0]!.notes.map((n) => n.id)).toEqual(['n2']);
  });
});

describe('applyTombstones — category last-touch', () => {
  it('keeps a tombstoned category whose own updated_at postdates the tombstone (restored)', () => {
    const ws = workspace('w', [category('c', { updated_at: 30 })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('c', 20)]));
    expect(out[0]!.categories).toHaveLength(1);
  });

  it('keeps a tombstoned category whose standalone notes were touched after the tombstone', () => {
    const ws = workspace('w', [category('c', { notes: [note('n', { updated_at: 30 })] })]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('c', 20)]));
    expect(out[0]!.categories).toHaveLength(1);
  });

  it('still drops an empty tombstoned category', () => {
    const ws = workspace('w', [category('c')]);
    const out = applyTombstones([ws], tombstonesFromTrash([tombstone('c', 20)]));
    expect(out[0]!.categories).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-category group dedupe (issue #17): union-merge is per container, so a
// group moved between categories on one device would otherwise be resurrected
// in its old category by a stale remote and appear twice.
// ---------------------------------------------------------------------------

describe('mergeSyncedState — group moved between categories', () => {
  const state = (workspaces: Workspace[]) => ({ workspaces, trash: [] as TrashItem[] });
  /** Ids of the categories holding the given group after a merge. */
  const holdersOf = (m: { workspaces: Workspace[] }, id = 'gM'): string[] =>
    m.workspaces[0]!.categories.filter((c) => c.groups.some((g) => g.id === id)).map((c) => c.id);

  /** Local state after moving gM from cOld to cNew (move bumps updated_at). */
  const movedLocal = () =>
    state([workspace('w', [
      category('cOld', { order: 0 }),
      category('cNew', { order: 1, groups: [group('gM', { updated_at: 100 })] }),
    ])]);
  /** Stale remote that still has gM in cOld (pre-move copy). */
  const staleRemote = () =>
    state([workspace('w', [
      category('cOld', { order: 0, groups: [group('gM', { updated_at: 10 })] }),
      category('cNew', { order: 1 }),
    ])]);

  it('keeps a moved group only in its new category (no duplicate)', () => {
    expect(holdersOf(mergeSyncedState(movedLocal(), staleRemote()))).toEqual(['cNew']);
  });

  it('is symmetric — the same winner regardless of which side is local', () => {
    expect(holdersOf(mergeSyncedState(movedLocal(), staleRemote()))).toEqual(['cNew']);
    expect(holdersOf(mergeSyncedState(staleRemote(), movedLocal()))).toEqual(['cNew']);
  });

  it('a newer edit in the old category outranks the move (group stays put, edit kept)', () => {
    // Remote renamed gM in cOld AFTER local's move timestamp
    const remote = state([workspace('w', [
      category('cOld', { order: 0, groups: [group('gM', { name: 'Renamed', updated_at: 200 })] }),
      category('cNew', { order: 1 }),
    ])]);
    const merged = mergeSyncedState(movedLocal(), remote);
    expect(holdersOf(merged)).toEqual(['cOld']);
    const gM = merged.workspaces[0]!.categories[0]!.groups.find((g) => g.id === 'gM')!;
    expect(gM.name).toBe('Renamed');
  });

  it('unions tabs from the losing copy so a concurrent save is not lost', () => {
    // Remote added tab tB to gM in cOld while local moved gM to cNew
    const local = movedLocal();
    local.workspaces[0]!.categories[1]!.groups[0]!.tabs = [tab('tA')];
    const remote = staleRemote();
    remote.workspaces[0]!.categories[0]!.groups[0]!.tabs = [tab('tA'), tab('tB')];

    const merged = mergeSyncedState(local, remote);
    expect(holdersOf(merged)).toEqual(['cNew']);
    const gM = merged.workspaces[0]!.categories
      .flatMap((c) => c.groups)
      .find((g) => g.id === 'gM')!;
    expect(gM.tabs.map((t) => t.id).sort()).toEqual(['tA', 'tB']);
  });

  it('breaks updated_at ties deterministically (exactly one copy survives)', () => {
    const sideA = state([workspace('w', [
      category('c1', { order: 0, groups: [group('gM', { updated_at: 50 })] }),
      category('c2', { order: 1 }),
    ])]);
    const sideB = state([workspace('w', [
      category('c1', { order: 0 }),
      category('c2', { order: 1, groups: [group('gM', { updated_at: 50 })] }),
    ])]);
    const ab = holdersOf(mergeSyncedState(sideA, sideB));
    const ba = holdersOf(mergeSyncedState(sideB, sideA));
    expect(ab).toHaveLength(1);
    expect(ab).toEqual(ba); // both devices converge on the same winner
  });

  it('renumbers group order in the category that lost the duplicate', () => {
    // cOld on the remote has another group after the stale gM copy
    const remote = staleRemote();
    remote.workspaces[0]!.categories[0]!.groups = [
      group('gM', { order: 0, updated_at: 10 }),
      group('gOther', { order: 1, updated_at: 10 }),
    ];
    const merged = mergeSyncedState(movedLocal(), remote);
    const cOld = merged.workspaces[0]!.categories.find((c) => c.id === 'cOld')!;
    expect(cOld.groups.map((g) => g.id)).toEqual(['gOther']);
    expect(cOld.groups[0]!.order).toBe(0);
  });
});
