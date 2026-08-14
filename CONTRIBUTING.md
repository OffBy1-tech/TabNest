# Contributing to Tab Nest

Thanks for your interest in Tab Nest. It's a free, MIT-licensed Chrome extension,
and contributions of all sizes are welcome — bug reports, docs fixes, and code.

- [Ground rules](#ground-rules)
- [Reporting bugs](#reporting-bugs)
- [Reporting security issues](#reporting-security-issues)
- [Suggesting features](#suggesting-features)
- [Development setup](#development-setup)
- [Verifying your changes](#verifying-your-changes)
- [Architecture rules](#architecture-rules)
- [Pull requests](#pull-requests)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Releases](#releases-maintainers)

---

## Ground rules

Two constraints are non-negotiable, because they're the reason the project exists:

1. **Privacy.** Tab data stays in the user's browser. The only network destination
   Tab Nest may ever talk to is the user's own Google Drive over OAuth. No
   analytics, no telemetry, no third-party servers, no bundled trackers. A PR that
   adds one won't be merged.
2. **No paid tiers or gated features.** Everything in the extension is free.

Be decent to each other in issues and PRs. Assume good faith, keep discussion on
the technical substance, and skip the personal remarks — maintainers will close
threads that don't.

---

## Reporting bugs

Open an issue at
[github.com/OffBy1-tech/TabNest/issues](https://github.com/OffBy1-tech/TabNest/issues)
and include:

- **What happened** and **what you expected** instead.
- **Steps to reproduce**, numbered.
- **Chrome version** (`chrome://version`) and OS.
- **Tab Nest version** (from `chrome://extensions`, or `package.json` if you built
  it yourself).
- **Whether Drive sync is enabled** — sync-related bugs behave very differently
  with it on.
- **Console errors** from both places, if any: the new tab page (DevTools →
  Console) and the service worker (`chrome://extensions` → Tab Nest → *service
  worker* → Console).

Bugs that involve losing or duplicating saved tabs are the highest priority; say
so explicitly if you hit one, and don't uninstall the extension before reporting —
that discards the local data that makes the bug diagnosable.

**Never paste real tab data, URLs you'd rather not publish, or an exported
backup file into a public issue.** Redact, or reproduce with a throwaway set of
tabs.

---

## Reporting security issues

Do **not** open a public issue for a vulnerability. Use GitHub's private
reporting: the repository's **Security** tab → **Report a vulnerability**. That
covers anything touching OAuth tokens, the Drive sync path, permissions in
`manifest.json`, or code that could exfiltrate stored tab data.

---

## Suggesting features

Open an issue describing the problem you're hitting before writing code — it's
cheaper to agree on the shape of a feature than to rework a finished PR. Useful
proposals say what you were trying to do, what you did instead, and why the
existing features don't cover it. Check
[`docs/tasks_todo.md`](docs/tasks_todo.md) and the open issues
first; the idea may already be tracked or already have been decided against.

---

## Development setup

**Prerequisites:** Node.js 24+ (see `.nvmrc`), npm 9+, Google Chrome 120+.

```bash
git clone https://github.com/OffBy1-tech/TabNest.git
cd TabNest
npm install
npm run build      # produces dist/
```

Load it in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. After each rebuild, hit the reload icon on the Tab Nest card

`npm run dev` is the faster loop for UI work: `vite-plugin-web-extension` writes
a development `dist/manifest.json`, launches a clean temp-profile Chrome with the
extension already loaded, and rebuilds and reloads on save — no manual reload
needed. Two things to know about it:

- The dev manifest doesn't go through `scripts/inject-oauth.js`, so it has no
  extension `key` and no real OAuth client ID. The extension therefore gets a
  different ID than a production build, and **Drive sync can't authenticate in
  dev mode.**
- Its `version` shows as `0.0.0`. The checked-in `manifest.json` carries that
  placeholder on purpose — `package.json` is the only source of truth for the
  version, and the build step writes the real one into `dist/manifest.json`.
  (It has to stay a valid version string: `0.0.0` works, something like `x.x.x`
  fails the plugin's manifest schema and kills the dev server.)

So anything touching Drive sync, OAuth, or install/upgrade behavior has to be
verified against `npm run build` + a manual unpacked load.

### Optional: Drive sync

Copy `.env.example` to `.env.local` and set `TABNEST_OAUTH_CLIENT_ID` to a Google
OAuth client ID of your own ([Google Cloud
console](https://console.cloud.google.com/apis/credentials), type *Chrome
Extension*). `scripts/inject-oauth.js` writes it into `dist/manifest.json` during
the build. Without it, the sync UI renders but authentication fails — that's fine
for most contributions.

`.env.local` is gitignored. Never commit a client ID, extension key, or token.

### Commands

| Command | What it does |
|---|---|
| `npm run build` | Build the extension into `dist/` (injects OAuth client ID + version) |
| `npm run dev` | Watching dev build + auto-launched Chrome (no OAuth — see above) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Vitest — `unit` (jsdom) and `storybook` (Playwright) projects. Watches locally; runs once under CI |
| `npm run coverage` | Full coverage report into `coverage/` |
| `npm run coverage:unit` | Coverage for the jsdom project only |
| `npm run coverage:badge` | Coverage run plus the README badge JSON (what CI publishes) |
| `npm run storybook` | Component explorer on `:6006` |

Run one test file:

```bash
npx vitest run src/lib/storage.test.ts
```

Run only the fast jsdom project (skips the browser tests):

```bash
npx vitest run --project unit
```

The `storybook` test project drives real Chromium through Playwright. If it fails
to launch, install the browser once with `npx playwright install chromium`.

---

## Verifying your changes

Before opening a PR, all four of these must pass:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Plus a manual pass: load the fresh `dist/` unpacked and exercise the paths you
touched. For anything in the storage or sync layer, also check that existing
saved data survives — install the previous build, save a few groups, then load
your build over it and confirm nothing is lost or duplicated.

---

## Architecture rules

Read [`CLAUDE.md`](./CLAUDE.md) for the full picture and
[`docs/TabNest_Specification.md`](docs/TabNest_Specification.md) for the product
spec. The rules below are the ones that cause real bugs when broken — several
have shipped data-loss regressions before.

**Storage**

- `src/lib/storage.ts` is the **only** module that may call `chrome.storage`
  directly. Everything else goes through its exports.
- `writeStorage(patch)` is the **only** write path. It reads before writing and
  serializes writes through a queue to avoid concurrent-write races. Return `null`
  from an updater to skip a no-op write — otherwise a full document write plus a
  Drive push gets scheduled for a change that changed nothing.
- **The mutation contract.** Any helper that changes a synced scalar on an
  existing entity must bump the `updated_at` its merge level compares, or the
  merge silently discards the edit on every other device. Tabs and notes have no
  comparison key of their own, so a tab-note edit bumps its **group** and a
  standalone-note edit bumps its **category**.
  `src/lib/storageContract.test.ts` enforces this: every export of `storage.ts`
  must be classified in its `CONTRACTS` table. **Adding an export fails CI until
  you classify it — that's the guard working, not a broken test.**
- Schema changes need a migration. Add it to the `MIGRATIONS` table in
  `storage.ts`, keyed by the **source** version, and bump the schema version.
  Never mutate an existing migration that has already shipped.
- `UserSettings` (synced) and `LocalSettings` (device-only) are deliberately
  separate. Don't move fields between them; `local_settings` is stripped from
  every Drive write.
- Backup snapshots live under the device-only `tabnest_backups` key, never in the
  hot `tabnest_data` document. Access them only via `pushLocalBackup` /
  `readLocalBackups` / `restoreLocalBackup`.

**Types and validation**

- Types are inferred from Zod schemas in `src/lib/schema.ts` — write the schema,
  infer the type, not the other way round.
- Validate at the boundaries: storage reads, imports, Drive responses, and every
  incoming extension message (`ExtensionMessageSchema.safeParse`). Don't add Zod
  parsing to hot read paths.
- Message responses always use `MessageResponse<T>`:
  `{ ok: true; data: T } | { ok: false; error: string }`.

**Background worker**

- MV3 service workers are killed at will. Use `chrome.alarms`, never
  `setInterval`/`setTimeout`, for anything recurring.
- All Drive I/O belongs in the service worker, not the UI.

**UI**

- Colors, spacing, and typography come from the CSS custom properties in
  `src/styles/tokens.css` (`var(--token-name)`). Tailwind is available, but don't
  use raw Tailwind values for anything the token file defines.
- Every component gets a `.stories.tsx` file. Stories double as browser tests via
  the Storybook Vitest project, so a story is a test, not just documentation.
- Import with the `@/` alias for `src/`.

**Permissions**

- Adding a permission or host to `manifest.json` needs a justification in the PR
  description. New permissions trigger a Chrome Web Store re-review and can force
  every existing user to re-accept, so they're a real cost.

---

## Pull requests

1. Fork and branch from `main`. Branch names like `fix/sync-drops-notes` or
   `feat/group-colors` are fine; nothing is enforced.
2. Keep the PR focused — one logical change. Drive-by refactors in a bugfix PR
   make the fix hard to review and hard to revert.
3. Add or update tests. Bugfixes should come with a test that fails before your
   change; new components need stories.
4. Update [`CHANGELOG.md`](./CHANGELOG.md) under an `## [Unreleased]` heading for
   any user-visible change. The format is [Keep a
   Changelog](https://keepachangelog.com/en/1.1.0/) — `Added` / `Changed` /
   `Fixed` / `Removed`. Purely internal refactors don't need an entry.
5. Write commit messages in the imperative mood with a short subject line
   (`Fix note edits being dropped on merge`), and a body explaining *why* when the
   reason isn't obvious from the diff.
6. In the PR description, say what you changed, why, and how you verified it —
   including what you exercised in a real unpacked build.

**PR checklist**

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds and the built extension was loaded and manually checked
- [ ] Tests and/or stories added for the change
- [ ] `CHANGELOG.md` updated for user-visible changes
- [ ] No credentials, tokens, or `.env.local` values in the diff
- [ ] New `storage.ts` exports classified in `CONTRACTS`; schema changes have a migration
- [ ] Any new `manifest.json` permission is justified in the description

`.github/workflows/ci.yml` runs the same four commands on every pull request, so
a PR that's green locally should be green there. Fork PRs don't get the build
secrets — that's expected, and the build is written to warn and continue without
them.

Maintainers review on a best-effort basis. Nudging a PR after a week is welcome,
not rude.

---

## Documentation

- [`README.md`](./README.md) — user-facing overview and install.
- [`CLAUDE.md`](./CLAUDE.md) — architecture and the contracts above.
- [`docs/README.md`](docs/README.md) — the docs index; start there.
- [`docs/TabNest_Specification.md`](docs/TabNest_Specification.md) — the product spec.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — the doc lifecycle
  rules. In short: current-reference docs are updated in place, plans are retired
  to `archive/` once shipped with their durable decisions folded up into the spec
  or `CLAUDE.md`, and historical records are never edited.

If your change makes something in these docs wrong, fix it in the same PR.

---

## Roadmap

The near-term backlog is [`docs/tasks_todo.md`](docs/tasks_todo.md);
[`docs/tasks_completed.md`](docs/tasks_completed.md) records what
has already landed. Anything not in either file is tracked as a GitHub issue.
Broad direction:

- Keep the extension free, local-first, and free of third-party services.
- Harden sync correctness — merge behavior, tombstones, and backup/restore — ahead
  of adding new surface area.
- Performance at large tab counts (see the virtualization note in the backlog).

If you want to work on something sizeable, comment on the issue first so two
people don't build it twice.

---

## Releases (maintainers)

1. Land everything for the release on `main`, with `npm run typecheck`,
   `npm run lint`, `npm test`, and `npm run build` all green.
2. Bump `version` in `package.json` only — semantic versioning.
   `scripts/inject-oauth.js` copies it into `dist/manifest.json` at build time;
   the checked-in `manifest.json` stays at the `0.0.0` placeholder.
3. Move `## [Unreleased]` in `CHANGELOG.md` to a dated version heading.
4. `npm run build:prod`, then load `dist/` unpacked and smoke-test the core flows
   (save, restore, search, import/export, and a Drive sync round-trip on two
   devices).
5. Tag the release, then upload the packaged `dist/` to the Chrome Web Store.

---

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
