# Doc conventions

Three kinds of document live here, each with its own rule:

1. **Current reference** — how it works *now* (spec, palette, open backlog).
   Update in place. Never date-stamp the body. Keep the set small.
2. **Design record** — a plan or spec for specific work. New ones go in
   `plans/` / `specs/` (create as needed). **Stop editing once shipped**: fold
   durable decisions up into a current-reference doc (usually
   `TabNest_Specification.md` or `CLAUDE.md`), add a
   `> status: shipped <date> (PR #N)` header, and `git mv` to `archive/`.
3. **Historical record** — dated snapshots, done-logs, audits. Never edit.

At ship time (part of merging any feature): fold up → retire the plan →
update [README.md](README.md) (the index). The index, not the folder layout,
answers "which doc is current?".
