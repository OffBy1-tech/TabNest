# tabNest — Tasks TODO

Features and requirements from the specification that are NOT yet fully implemented.
Last updated: 2026-07-08 (workItems branch — the 2026-07-07 backlog has been implemented;
see `tasks_completed.md` for the full record).

---

## Notes

> **Decision (2026-07):** Drive sync stays on the hidden `appDataFolder` space with the
> `drive.appdata` OAuth scope (spec §9 amended accordingly).

- [ ] **True windowed virtualization (optional)** — spec §16 asks for virtual scrolling at
  1000+ tabs. Implemented as CSS `content-visibility: auto` render-skipping on group cards,
  note cards, and active-tab rows, which covers the practical cases without a windowing
  dependency. If profiling ever shows DOM-size problems at extreme scale, revisit with
  react-window or equivalent.

---
