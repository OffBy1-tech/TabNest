# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-06-23

### Changed

- Project-wide component refactor: every file that previously held multiple
  React components was split so each component lives in its own file. This
  covers `GroupCard`, `SettingsModal`, `CategoryList`, `ActiveTabsPanel`,
  `TopBar`, `OnboardingOverlay`, and the new-tab and popup roots. Shared
  helpers, hooks, and style objects were extracted into dedicated modules
  (e.g. `mergeImportedData`, `useActiveTabs`, `openTab`, `popupStorage`).
- Migrated ESLint to the flat-config format (`eslint.config.js`) for ESLint
  9/10 and removed the legacy `.eslintrc.json`.

### Added

- Unit test suite (Vitest + Testing Library on jsdom) covering the split
  components and the extracted logic modules.
- A Storybook story for every extracted component, rendered in a real browser
  via the Storybook + Playwright Vitest project.
- Test-coverage tooling: `npm run coverage` (all projects) and
  `npm run coverage:unit` (jsdom only), writing an HTML + JSON report to
  `coverage/`.

### Fixed

- Cleared numerous pre-existing TypeScript errors in the refactored files
  (focus-trap index assertions, `exactOptionalPropertyTypes` prop widening,
  and stale Storybook prop types).

## [1.0.3] - 2026-06-23

### Added

- The left sidebar can now be resized so full category names are visible.

### Fixed

- Opening a saved tab with the "New window" behavior now opens a real Chrome
  window with its toolbar intact, instead of dropping the toolbar.

## [1.0.2] - 2026-06-08

### Changed

- Switched Google Drive sync back to using `drive.appdata` storage.

### Added

- Remember the last group a tab was saved to and preselect it for the next save.

### Fixed

- Improved data diffing during sync.

## [1.0.0] - 2026-06-05

- Initial release.
