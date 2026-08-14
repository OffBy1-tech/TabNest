# Tab Nest

**Free, open-source Chrome tab manager with Google Drive sync.**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/necndpocofifkmoekdgbocklmmnldegp?logo=googlechrome&label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/tab-nest/necndpocofifkmoekdgbocklmmnldegp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/OffBy1-tech/TabNest/actions/workflows/ci.yml/badge.svg)](https://github.com/OffBy1-tech/TabNest/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://offby1-tech.github.io/TabNest/coverage-badge.json)](https://offby1-tech.github.io/TabNest/)

Tab Nest lets you save, organize, and search your browser tabs without losing context. Sessions are stored locally by default and can be optionally synced to your personal Google Drive — no third-party servers, no subscriptions, no data sold to anyone.

---

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/tab-nest/necndpocofifkmoekdgbocklmmnldegp)

---

## Quick Start

### Prerequisites

- Node.js 24+ (see `.nvmrc`; npm ships with it)
- Google Chrome 120+

### Development Setup

```bash
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder in this repository

After changing anything under `src/`, run `npm run build` again and click the reload icon on the Tab Nest card in `chrome://extensions` to pick up the update.

For a faster loop, `npm run dev` rebuilds on save and launches a separate Chrome window with the extension already loaded. Drive sync doesn't authenticate in that mode — use a full `npm run build` to test anything sync-related.

---

## Privacy

Tab Nest stores all tab data locally in your browser. Google Drive sync is opt-in and writes only to your own Drive account using OAuth — Tab Nest never sees or stores your Drive credentials, and no data is sent to any Tab Nest-operated server.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on reporting issues, submitting pull requests, and the project roadmap.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
