/**
 * Pure sync decision logic, extracted from the service worker's runSync so it
 * can be unit-tested (src/lib/syncPlan.test.ts reproduces the multi-device
 * scenarios directly).
 *
 * Whenever a remote document exists, both sides are union-merged — there is
 * deliberately NO "local wins, blind-push" fast path. Comparing
 * last_modified_at timestamps cannot distinguish "remote is unchanged since I
 * last pulled" from "remote changed concurrently but my local edit happens to
 * be newer"; the old fast path took the second case for the first and pushed
 * local state over a concurrent remote change, wiping deletion tombstones from
 * Drive (the restore-then-redelete smoke-test bug). mergeSyncedState honors
 * tombstones from either side's trash, so always merging is safe, and the
 * write/push flags below keep the steady state quiet (no redundant local
 * writes or Drive uploads when nothing changed).
 */

import { mergeSyncedState } from './merge';
import type { TrashItem, UserSettings, Workspace } from './schema';

export interface SyncSideState {
  workspaces: Workspace[];
  settings: UserSettings;
  trash: TrashItem[];
  sync_meta: { last_modified_at: number };
}

export interface SyncPlan {
  /** Snapshot local workspaces into backup_generations before writing — set
   *  exactly when the merge is about to change them. */
  backupFirst: boolean;
  /** Patch to write to local storage, or null when local already holds the
   *  merged result (skips a no-op write and its last_modified_at bump). */
  write: { workspaces: Workspace[]; settings: UserSettings; trash: TrashItem[] } | null;
  /** Upload the (written or unchanged local) document to Drive. */
  push: boolean;
  /** When local was rewritten purely from remote data, adopt remote's
   *  last_modified_at — the write's automatic bump would otherwise make local
   *  look newer than remote and ping-pong pushes between devices forever. */
  adoptRemoteModifiedAt: number | null;
}

export function planSync(local: SyncSideState, remote: SyncSideState | null): SyncPlan {
  if (remote === null) {
    // Nothing on Drive — seed it with local state.
    return { backupFirst: false, write: null, push: true, adoptRemoteModifiedAt: null };
  }

  const merged = mergeSyncedState(local, remote);
  // Settings are last-write-wins by whole-document timestamp; ties go to local.
  const remoteNewer = remote.sync_meta.last_modified_at > local.sync_meta.last_modified_at;

  // Deliberately strict JSON equality: timestamp/order fields are load-bearing
  // for tombstone resolution, so a "semantic" compare that ignored them could
  // skip pushing a restore-after-delete. The only failure mode of strictness
  // is a false negative from array/key ordering, costing one redundant Drive
  // push that converges on the next cycle. Each distinct document is
  // serialized exactly once — these are the extension's largest objects.
  const mergedWs = JSON.stringify(merged.workspaces);
  const mergedTrash = JSON.stringify(merged.trash);
  const localWs = JSON.stringify(local.workspaces);
  const localTrash = JSON.stringify(local.trash);
  const remoteWs = JSON.stringify(remote.workspaces);
  const remoteTrash = JSON.stringify(remote.trash);
  const localSettings = JSON.stringify(local.settings);
  const remoteSettings = JSON.stringify(remote.settings);
  const settings = remoteNewer ? remoteSettings : localSettings;

  const matchesLocal = mergedWs === localWs && mergedTrash === localTrash && settings === localSettings;
  const matchesRemote = mergedWs === remoteWs && mergedTrash === remoteTrash && settings === remoteSettings;

  return {
    backupFirst: mergedWs !== localWs,
    write: matchesLocal
      ? null
      : {
          workspaces: merged.workspaces,
          settings: remoteNewer ? remote.settings : local.settings,
          trash: merged.trash,
        },
    push: !matchesRemote,
    // Merged result matches remote, but local had to be rewritten from it.
    adoptRemoteModifiedAt:
      matchesRemote && !matchesLocal ? remote.sync_meta.last_modified_at : null,
  };
}
