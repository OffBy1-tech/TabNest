# Tab Nest

**Free, open-source Chrome tab manager with Google Drive sync.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-lightgrey?logo=googlechrome)](https://chromewebstore.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/your-org/tabnest/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/tabnest/actions/workflows/ci.yml)

Tab Nest lets you save, organize, and search your browser tabs without losing context. Sessions are stored locally by default and can be optionally synced to your personal Google Drive — no third-party servers, no subscriptions, no data sold to anyone.

---

[Install from Chrome Web Store](https://chromewebstore.google.com) *(coming soon)*

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+ (`npm install -g corepack && corepack enable`)
- Google Chrome 120+

### Development Setup

```bash
npm install
npm dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder in this repository

Changes to `src/` are rebuilt automatically while `npm dev` is running. Reload the extension in `chrome://extensions` to pick up updates.

---

## Privacy

Tab Nest stores all tab data locally in your browser. Google Drive sync is opt-in and writes only to your own Drive account using OAuth — Tab Nest never sees or stores your Drive credentials, and no data is sent to any Tab Nest-operated server.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on reporting issues, submitting pull requests, and the project roadmap.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
