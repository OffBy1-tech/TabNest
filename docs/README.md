# Docs index

Which doc is current is answered here, not by the folder layout. See
[CONVENTIONS.md](CONVENTIONS.md) for the lifecycle rules.

## Current reference

| Doc | What it covers |
|---|---|
| [`TabNest_Specification.md`](TabNest_Specification.md) | The product spec — features, data model, sync behavior. The one to update when shipped behavior changes. |
| [`../CLAUDE.md`](../CLAUDE.md) | Architecture and the contracts that break things when violated (storage write path, mutation contract, migrations). |
| [`Color_Palette.md`](Color_Palette.md) | Design tokens and color usage. Mirrors `src/styles/tokens.css`. |
| [`tasks_todo.md`](tasks_todo.md) | Open backlog — spec items not yet fully implemented. |
| [`smoke-test.md`](smoke-test.md) | The two-machine by-hand smoke test that gates a public release. |
| [`CONVENTIONS.md`](CONVENTIONS.md) | How docs in this folder are written, retired, and indexed. |

## Historical record

| Doc | What it covers |
|---|---|
| [`tasks_completed.md`](tasks_completed.md) | Done-log of shipped backlog items. Append-only. |
| [`archive/`](archive) | Design records for shipped work, marked `status: shipped`. Never edited after retirement — the durable decisions live in the spec or `CLAUDE.md` instead. |

## Contributing

Contributor-facing process (setup, verification, PRs, releases) is in
[`../CONTRIBUTING.md`](../CONTRIBUTING.md), not here.
