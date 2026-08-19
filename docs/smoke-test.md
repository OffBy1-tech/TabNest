# Two-machine smoke test

The by-hand pass that gates a public release, run on top of the automated
suite. Two machines, the same Google account, the same build. Reconstructed
2026-08-15 — the original procedure lived in the untracked `.claude/docs/`
and did not survive the clean-history repo rebuild; this version is rebuilt
from the 1.1.x changelog entries and the shipped sync design
([archive/2026-08-06-sync-union-merge-and-generational-backup.md](archive/2026-08-06-sync-union-merge-and-generational-backup.md)).

Conventions: the two machines are **A** and **B**. "Sync" means trigger a
sync on the machine that wrote (Sync now in Settings, or wait out the
interval), then on the machine that reads. After any step that syncs, give
the second machine a moment and confirm the state actually arrived rather
than assuming it did.

## 0. Setup

- [ ] Both machines run the same version — either the unlisted store install
      or `npm run build:prod` + load `dist/` unpacked. Note the version.
- [ ] A: connect Drive sync; status shows connected.
- [ ] B: connect the same Google account. First-connect pull brings A's data
      down intact (workspaces, categories, groups, notes).

## 1. Core flows (single machine, A)

- [ ] Save a single tab into a group; save a whole window as a group.
- [ ] Restore a group (all tabs), then restore a single tab from a group.
- [ ] Search (`Cmd/Ctrl+K`) finds saved tabs and notes across workspaces.
- [ ] Notes: create, edit, delete a category note.
- [ ] Drag-reorder categories and groups; order sticks after a reload.
- [ ] Delete a group → it lands in Trash; restore it from Trash.
- [ ] Export JSON: the file contains workspaces/settings/trash only — no
      backup snapshots. Re-import it; state round-trips.
- [ ] Popup opens on `Alt+T`. Theme toggle works.
- [ ] `bookmarks` permission is only requested when a bookmarks feature is
      used, never at install.

## 2. Basic two-device round-trip

- [ ] Create a workspace + category + group on A → appears on B.
- [ ] Edit the same group on B (add a tab) → change returns to A.
- [ ] Sync settles: after both sides converge, no repeated pushes / the
      last-synced time stops churning (the ping-pong guard).

## 3. 1.1.x sync semantics (the extended pass)

This is the part the 1.1.2 release notes call out: tombstones at every
level, restore re-stamping, move dedupe, and the theme-toggle desync path.

- [ ] **Deletions propagate at every level.** One at a time on A — delete a
      tab (via Trash), a group, a category, and a workspace; sync after
      each. Each disappears on B and stays gone on later syncs (no
      resurrection).
- [ ] **Restore outranks its tombstone.** Delete a group on A, sync until B
      sees it gone. Restore it from Trash on A, sync → it reappears on B.
- [ ] **Union-merge preserves unsynced local data.** With B not yet synced
      (offline or just not triggered), save a new group on B. Meanwhile edit
      something on A and sync (A is now newer on Drive). Sync B → B's new
      group survives the remote-wins path and shows up on A on the next
      cycle. Nothing is silently discarded.
- [ ] **Move dedupe.** Move a group to a different category on A while B
      still holds the stale pre-move copy. Sync both → exactly one copy of
      the group exists, in the new category. If B saved a tab into that
      group concurrently, the tab is in the surviving copy, not lost.
- [ ] **Renames survive.** Rename a group and a workspace on A → both new
      names arrive on B, and the old names never come back on later syncs.
- [ ] **Category notes converge.** Edit a note on A, sync; edit it again on
      B, sync → both sides settle on B's text with no back-and-forth.
- [ ] **Hide-from-All (Eye) toggle propagates** from one machine to the
      other deliberately, not just alongside unrelated edits.
- [ ] **Theme-toggle desync path.** Toggle the theme on B (a settings-only
      change) and sync. Theme propagates (settings are last-write-wins);
      no workspace data on A changes, disappears, or reverts.

## 4. Latent-bug hunting

- [ ] Service worker console on both machines: no errors accumulated over
      the whole pass (`chrome://extensions` → service worker → Inspect).
- [ ] Drive revision restore: list revisions in Settings, restore an older
      one, confirm the current state was snapshotted first and the restore
      lands correctly.
- [ ] Disconnect Drive on B → everything keeps working local-only.
      Reconnect → merges cleanly with what A pushed in the meantime.

## Accepted limitations (do not file as failures)

- Deletions that bypass Trash can resurrect on a later merge — accepted in
  issue #6.
- Settings (including theme) are last-write-wins; concurrent settings edits
  on both machines resolve to the newer one.

## Recording the result

Note the date, version, machines, and outcome. Failures become GitHub
issues; a clean pass on the current store version closes the pre-public
smoke-test gate.
