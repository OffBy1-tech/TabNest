# tabNest — Tasks TODO

Features and requirements from the specification that are NOT yet fully implemented.
Last updated: 2026-07-07 (re-audited against the post-refactor codebase on `componentRefactor`).
Items verified as complete were moved to `tasks_completed.md` (see its "Re-audit 2026-07-07" section).

---

## Sync — Google Drive

> **Decision (2026-07):** TabNest stays on the hidden `appDataFolder` space with the
> `drive.appdata` OAuth scope. The spec §9.1/§9.3 items calling for a visible
> "TabNest Backups" folder and the `drive.file` scope are intentionally not being
> implemented — the spec should be updated to match.


---

## Performance

- [ ] **Virtual scrolling for large tab lists** — spec §16: virtual scrolling for 1000+ tab entries; GroupGrid renders everything with no virtualization

---


