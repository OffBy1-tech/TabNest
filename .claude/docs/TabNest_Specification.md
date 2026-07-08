# TabNest — Chrome Extension
## Product Specification
**Version 1.0 · Free Tab Manager with Google Drive Sync**

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Concepts & Data Model](#2-core-concepts--data-model)
3. [New Tab Page Interface](#3-new-tab-page-interface)
4. [Active Tabs Panel](#4-active-tabs-panel)
5. [Saving Tabs — All Methods](#5-saving-tabs--all-methods)
6. [Tab Group Management](#6-tab-group-management)
7. [Notes & To-Dos](#7-notes--to-dos)
8. [Search](#8-search)
9. [Google Drive Sync](#9-google-drive-sync)
10. [Workspace Management](#10-workspace-management)
11. [Settings](#11-settings)
12. [Extension Toolbar Popup](#12-extension-toolbar-popup)
13. [Trash / Bin](#13-trash--bin)
14. [Chrome Permissions](#14-chrome-permissions)
15. [First Run Experience](#15-first-run-experience)
16. [Performance Requirements](#16-performance-requirements)
17. [Error Handling & Edge Cases](#17-error-handling--edge-cases)
18. [Future Roadmap (V2 Considerations)](#18-future-roadmap-v2-considerations)
- [Appendix: File Structure](#appendix-file-structure)

---

## 1. Product Overview

TabNest is a free, open-source Chrome Extension that replaces the browser's new tab page with a powerful tab management interface. Users can save, organize, search, and restore tabs across browsing sessions, with all data optionally synced to their personal Google Drive account — ensuring nothing is ever stored on third-party servers.

Inspired by tabExtend, TabNest improves on the concept by being permanently free with no feature paywalls, using Google Drive as the sole sync backend (no proprietary account required), and providing a clean, distraction-free interface designed for keyboard-first power users.

### 1.1 Design Philosophy

- Free forever — no subscriptions, no paywalls, no ads
- Privacy-first — all data lives in the user's own Google Drive
- Keyboard-driven — every action reachable without a mouse
- Minimal but powerful — clean UI that scales to heavy use
- Offline-capable — full functionality without internet connectivity

### 1.2 Tech Stack

| Component | Choice |
|---|---|
| Extension Type | Manifest V3 Chrome Extension (new tab override) |
| Frontend Framework | React 19 + TypeScript |
| Styling | Tailwind CSS with CSS variables for theming |
| Build Tool | Vite |
| Storage — Local | chrome.storage.local (fast, offline-first cache) |
| Storage — Sync | Google Drive REST API (user's own Drive folder) |
| Auth | Chrome Identity API (OAuth2 Google Sign-In, optional) |
| Search | Fuse.js (fuzzy client-side full-text search) |
| Drag & Drop | dnd-kit |
| Icons | Lucide React |

---

## 2. Core Concepts & Data Model

### 2.1 Hierarchy

The data model uses a three-level hierarchy:

- **Workspace** — top-level container (e.g., "Work", "Personal", "Side Projects"). Users can have multiple workspaces and switch between them.
- **Category** — a named section within a workspace (e.g., "Research", "Shopping", "Docs to Read"). Categories can be collapsed/expanded, reordered by drag-and-drop, and color-coded.
- **Tab Group** — a named collection of one or more saved tabs within a category. Groups can contain tabs and/or notes. Groups are the primary unit of save/restore.

### 2.2 Item Types

| Type | Description |
|---|---|
| Saved Tab | A URL snapshot: title, URL, favicon URL, saved timestamp, optional note |
| Note | Free-text note (supports basic Markdown: bold, italic, bullet, checklist) optionally attached to a Tab Group or standalone |
| Tab Group | Named collection of tabs and/or notes; can be opened all-at-once or individually |
| Category | Labeled container for Tab Groups; has color, emoji, collapse state |
| Workspace | Root container; holds categories; has a name and creation date |

### 2.3 Data Schema (JSON)

```json
{
  "schema_version": 1,
  "workspaces": [{
    "id": "uuid",
    "name": "Work",
    "created_at": "ISO8601",
    "categories": [{
      "id": "uuid",
      "name": "Research",
      "color": "#1A56DB",
      "emoji": "🔬",
      "collapsed": false,
      "order": 0,
      "groups": [{
        "id": "uuid",
        "name": "AI Papers",
        "created_at": "ISO8601",
        "order": 0,
        "tabs": [{
          "id": "uuid",
          "title": "Attention Is All You Need",
          "url": "https://arxiv.org/abs/1706.03762",
          "favicon": "https://arxiv.org/favicon.ico",
          "saved_at": "ISO8601",
          "note": "Must read before Tuesday"
        }],
        "notes": [{
          "id": "uuid",
          "content": "### To-Do\n- [ ] Read intro\n- [x] Skim abstract",
          "created_at": "ISO8601"
        }]
      }]
    }]
  }]
}
```

---

## 3. New Tab Page Interface

When the user opens a new tab, TabNest replaces Chrome's default new tab page with the TabNest UI. The page loads instantly from local storage and syncs in the background.

### 3.1 Layout

| Region | Description |
|---|---|
| Left Sidebar | Workspace switcher + Category navigation list (collapsible, ~240px wide) |
| Main Content Area | Scrollable area displaying Tab Groups within the selected category |
| Top Bar | Search input, active-tabs toggle, workspace name, settings icon |
| Right Panel (optional) | Shown on wide screens: Active Tabs panel or Notes panel |

### 3.2 Top Bar

- Global search bar (keyboard shortcut: `/` or `Cmd/Ctrl+K`) — searches across all workspaces
- **"Active Tabs"** button — opens the Active Tabs panel showing all open tabs across all Chrome windows
- Current workspace name (clickable to switch workspaces)
- Theme toggle (light/dark)
- Settings icon — opens settings modal
- Sync status indicator — shows last sync time, syncing spinner, or offline/error state

### 3.3 Left Sidebar

- Workspace selector at top — click to open workspace switcher dropdown; shows all workspaces with option to create new or rename/delete existing
- Category list below — each category shows its emoji, name, and group count
- Clicking a category scrolls/filters the main content area to that category
- **"All"** pseudo-category at top shows all groups across all categories
- Drag handles on categories to reorder them
- Right-click context menu on categories: Rename, Change color, Change emoji, Delete, Collapse all groups
- **"+ New Category"** button at the bottom of the list

### 3.4 Main Content Area

- Displays Tab Groups as cards in a responsive grid or list layout (user-configurable)
- Each group card shows: group name, tab count, list of tab favicons + titles, creation date, optional note preview
- Clicking a tab title opens that tab in the current or a new tab
- **"Open All"** button on each group card opens all tabs in the group as a new Chrome window
- Drag-and-drop to reorder groups within a category or move groups between categories
- Right-click context menu on group cards: Rename, Move to category, Duplicate, Delete, Open all in window, Open all in new window
- Inline expand/collapse of groups

---

## 4. Active Tabs Panel

The Active Tabs Panel shows all currently open tabs across all Chrome windows in real time. It is the primary interface for saving tabs into TabNest.

### 4.1 Display

- Grouped by Chrome window — each window shown as a collapsible section with its tab count
- Each tab entry shows: favicon, page title, URL (truncated), close button, save button
- Currently active tab highlighted with a colored indicator
- Auto-refreshes as tabs are opened, closed, or navigated

### 4.2 Saving Tabs

- **"Save"** icon on hover of each tab — opens a quick-save popover to select destination category and group (or create new group)
- **"Save All Tabs in Window"** button at the top of each window section — saves all tabs into a new or existing group
- **"Save Selected"** — checkbox multi-select on tabs, then bulk save to a group
- **"Save & Close"** — saves the tab(s) and immediately closes them in Chrome
- Drag-and-drop from Active Tabs panel into a category in the sidebar or onto a group card in the main area

### 4.3 Tab Actions

- Click tab title to switch to that tab
- Close individual tabs from the panel without leaving the new tab page
- **"Close Duplicates"** button — automatically closes any duplicate tabs across windows
- **"Sort"** options for active tabs: by domain, by window, by title

---

## 5. Saving Tabs — All Methods

### 5.1 From the New Tab Page

- Drag active tabs from the Active Tabs panel into a category or group
- Click "Save" icon next to any active tab in the Active Tabs panel
- "Save All Windows" option in the top bar saves every open tab into auto-named groups

### 5.2 From Any Page — Extension Popup

- Clicking the TabNest toolbar icon opens a compact popup showing the current tab
- One-click **"Save Tab"** button with a destination picker (category + group)
- Option to add a note to the saved tab
- Recent groups shown for fast re-use (no picker required for repeat destinations)
- Keyboard shortcut to open popup: configurable (default `Alt+T`)

### 5.3 Context Menu

- Right-click on any web page shows **"Save to TabNest"** in the Chrome context menu
- Right-click on a link shows **"Save Link to TabNest"**
- Both open a small modal to choose destination

### 5.4 Import from Bookmarks

- Settings > Import > Bookmarks — user selects a bookmarks folder
- Each bookmark folder becomes a Tab Group; the parent folder becomes a Category
- Duplicate detection: warns user if URLs already exist in TabNest

---

## 6. Tab Group Management

### 6.1 Creating Groups

- **"+ New Group"** button within a category creates an empty group
- Saving tabs from the Active Tabs panel with "New group" option auto-names the group from the window title or leading domain
- Groups can be created from Chrome's built-in Tab Groups (import)

### 6.2 Editing Groups

| Action | Behavior |
|---|---|
| Rename | Click group name to edit inline (Enter to confirm, Escape to cancel) |
| Reorder tabs | Drag handles on individual tabs within a group to reorder |
| Add tabs | Drag from Active Tabs panel or use the + button to enter a URL manually |
| Add note | Notes icon on group opens an inline markdown editor |
| Move group | Drag group card to different category, or use right-click > Move to |
| Duplicate | Creates a copy of the group with all tabs in the same category |
| Archive | Moves group to a special Archive category (hidden from main view but searchable) |
| Delete | Moves to Trash; permanently deleted after 30 days or manual empty |

### 6.3 Opening Groups

- **"Open All"** — opens all tabs in new window
- **"Open All in Background"** — opens all tabs in new window, stays focused on current window
- **"Open in Current Window"** — opens all tabs in the current Chrome window
- Clicking individual tab entries opens that single tab
- Restored groups are not automatically deleted from TabNest (non-destructive by default, toggleable in settings)

---

## 7. Notes & To-Dos

### 7.1 Note Types

- **Group Note** — attached to a Tab Group; displayed inline below the tabs
- **Standalone Note** — appears as a card in a category with no associated tabs

### 7.2 Editor

- Lightweight Markdown editor (rendered preview by default, click to edit)
- Supported formatting: bold, italic, inline code, headers (`##`), unordered lists (`- item`), ordered lists (`1. item`), checkboxes (`- [ ] item` and `- [x] item`)
- Auto-save on blur with debounce (no manual save button needed)
- Character count displayed for longer notes

### 7.3 Checklist Behavior

- Checkboxes in notes are interactive — click to toggle checked state without entering edit mode
- Checked items can optionally be visually struck-through
- **"Clear checked items"** option removes all completed checklist items

---

## 8. Search

### 8.1 Global Search

- Triggered by clicking the search bar or pressing `/` or `Cmd/Ctrl+K`
- Searches across all workspaces: tab titles, URLs, domains, group names, category names
- **Note content is deliberately excluded from the index** — notes can contain sensitive personal information and must never surface in search results (decision 2026-07; overrides earlier drafts that indexed notes)
- Results appear as a command-palette-style dropdown with keyboard navigation (arrow keys, Enter to select, Escape to close)
- Results grouped by type: Tabs, Groups, Categories
- Each result shows breadcrumb: Workspace > Category > Group
- Clicking a tab result opens that URL; clicking a group result navigates to that group in the UI

### 8.2 Search Algorithm

- Powered by Fuse.js for fuzzy matching — handles typos and partial matches
- Weighted scoring: title > URL domain > group name
- Results ranked by relevance score, then recency
- Minimum 1 character to trigger results

### 8.3 Filter & Sort

- Filter chips below search bar: by workspace, by category, by date range, by type (tab / group / category)
- Sort options: Relevance, Newest, Oldest, A-Z
- Active filters persist for the session

---

## 9. Google Drive Sync

All sync is optional. TabNest works fully offline using `chrome.storage.local`. Google Drive sync is an opt-in feature that backs up data to the user's own Drive — no TabNest servers are involved.

### 9.1 Setup

- User clicks **"Connect Google Drive"** in Settings
- Standard Google OAuth2 flow via Chrome Identity API — user grants access to TabNest's hidden application data space only
- TabNest stores its sync data in Drive's hidden **`appDataFolder`** — it does not appear in the user's visible Drive and cannot conflict with their own files
- A single merged JSON file (`tabnest_data.json`) is stored in this space

> **Decision (2026-07):** An earlier draft of this spec called for a visible "TabNest Backups"
> folder using the `drive.file` scope. The project deliberately moved back to the hidden
> `appdata` space to keep sync data out of the user's visible Drive.

### 9.2 Sync Behavior

| Setting | Detail |
|---|---|
| Auto-sync frequency | Every 5 minutes while the browser is open (debounced on changes) |
| Conflict resolution | Last-write-wins with timestamp comparison; a local backup is kept before overwriting |
| Manual sync | "Sync Now" button in settings and in the top bar indicator |
| Sync scope | All workspaces in a single merged JSON file (`tabnest_data.json`) |
| Versioning | Drive's built-in revision history provides rollback; TabNest shows last 10 versions in Settings > Restore |
| Offline behavior | All changes saved locally; synced automatically when connectivity resumes |
| Multi-device | Opening TabNest on a second device pulls the latest Drive data on load |

### 9.3 Privacy & Security

- OAuth scope requested: `https://www.googleapis.com/auth/drive.appdata` — only accesses TabNest's hidden application data folder, never the user's own Drive files
- Data is stored as plain JSON — human-readable and portable
- Users can revoke Drive access at any time from Google Account settings or TabNest settings
- No data is ever transmitted to TabNest/extension developer servers
- Export to local JSON available at any time: Settings > Export Data

---

## 10. Workspace Management

- Users can have unlimited workspaces
- Workspaces are shown in the sidebar switcher as named tabs or a dropdown
- Default workspace created on first install: **"My Workspace"**
- Create new workspace: opens naming modal, optionally copies categories from existing workspace as a template
- Rename workspace: inline edit in the switcher
- Delete workspace: confirmation required; moves all contained data to Trash
- Workspaces are independent — search can be scoped to current workspace or all workspaces

---

## 11. Settings

### 11.1 General

| Setting | Options |
|---|---|
| Theme | Light / Dark / System (follows OS preference) |
| Accent color | Color picker for primary UI accent (default: blue `#1A56DB`) |
| Default view | Grid view or List view for Tab Groups |
| Open tab behavior | Open tabs in current tab, new tab, or new window |
| Save & close | Toggle: automatically close a tab in Chrome after saving it to TabNest |
| Show favicons | Toggle favicon display on tab entries |
| Compact mode | Reduces padding for information-dense display |

### 11.2 New Tab Page

| Setting | Options |
|---|---|
| Active tabs on load | Show/hide Active Tabs panel automatically when new tab opens |
| Default workspace | Which workspace to display on new tab open |
| Show clock | Toggle a simple digital clock in the top-right corner |
| Background | Solid color or gradient preset for the new tab background (decision 2026-07: no custom image upload — avoids storing large blobs in chrome.storage) |

### 11.3 Sync

| Setting | Options |
|---|---|
| Google Drive connection | Connect / Disconnect button with account display |
| Auto-sync toggle | Enable or disable automatic syncing |
| Sync interval | 5 min / 15 min / 30 min / Manual only |
| Sync status | Last successful sync timestamp, error messages |
| Restore from backup | Lists Drive revision history, allows one-click restore |
| Export JSON | Downloads `tabnest_data.json` to local disk |
| Import JSON | Loads a previously exported JSON file (merge or replace mode) |

### 11.4 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` or `Cmd/Ctrl+K` | Open global search |
| `Alt+T` | Open extension popup from any page (configurable) |
| `Cmd/Ctrl+S` | Save current tab (from popup) |
| `N` | Create new group in current category (when search is not focused) |
| `E` | Edit selected group name |
| `Delete` / `Backspace` | Move selected group to Trash (with confirmation) |
| `Arrow keys` | Navigate search results / group list |
| `Escape` | Close modals, dropdowns, search |

### 11.5 Import & Export

- Import from bookmarks (Chrome bookmark folders)
- Import from OneTab export format (text list of URLs)
- Import from TabNest JSON backup
- Export full data as JSON
- Export a single group as a text list of URLs (for sharing)

---

## 12. Extension Toolbar Popup

The toolbar popup is the small UI that appears when clicking the TabNest icon in Chrome's toolbar. It is designed for fast saving without navigating to the new tab page.

- Shows the current tab's favicon, title, and URL
- **"Save Tab"** button with inline destination picker (category dropdown + group dropdown or "New group" option)
- Recently used groups shown as quick-access chips below the destination picker
- **"Add note"** text field — optional note attached to the saved tab
- **"View TabNest"** link — opens the new tab page
- Sync status dot in the corner (green = synced, orange = pending, red = error)
- Keyboard navigable: Tab key moves through fields, Enter saves

---

## 13. Trash / Bin

- All deleted items (groups, tabs, notes, categories) go to Trash instead of being immediately destroyed
- Trash accessible via sidebar bottom or Settings > Trash
- Items in Trash show name, original location, and deletion date
- **"Restore"** button returns item to its original location (or root if the parent was also deleted)
- **"Delete Permanently"** button immediately destroys the item
- **"Empty Trash"** button clears all items
- Auto-purge: items older than 30 days are automatically and permanently deleted

---

## 14. Chrome Permissions

| Permission | Usage |
|---|---|
| `newtab` override | Required — replaces the new tab page with TabNest UI |
| `tabs` | Required — reads open tabs for the Active Tabs panel; listens for tab changes |
| `storage` | Required — local data persistence via `chrome.storage.local` |
| `identity` | Required for Google Drive sync — OAuth2 token management |
| `contextMenus` | Used for right-click save options on pages and links |
| `alarms` | Required — schedules periodic Drive sync and daily trash purge (MV3 service workers cannot use `setInterval`) |
| `unlimitedStorage` | Required — lifts the `chrome.storage.local` quota for users with very large tab collections |
| `bookmarks` | Optional — only requested when user initiates bookmark import |
| `history` | Not requested — TabNest does not access browsing history |

All optional permissions are requested on-demand (when the user initiates the relevant feature) using the `chrome.permissions.request` API, not on install.

---

## 15. First Run Experience

- On first install, new tab page shows a brief 3-step onboarding overlay (dismissible)
- **Step 1:** Save your first tab — prompts user to save any open tab (decision 2026-07: the flow starts hands-on; the separate layout-overview step from earlier drafts was dropped)
- **Step 2:** Meet your workspace — workspaces, categories, and groups
- **Step 3:** Optional — connect Google Drive for sync
- A default workspace **"My Workspace"** and one example category **"Getting Started"** with a welcome group are created
- The welcome group contains 2–3 example saved tabs (TabNest help page, keyboard shortcuts page)
- Onboarding can be re-triggered from Settings > Help > Show Onboarding

---

## 16. Performance Requirements

| Metric | Target |
|---|---|
| New tab load time | < 200ms to interactive (content served from `chrome.storage.local`, no network required) |
| Search response time | < 50ms for results across up to 10,000 saved tabs |
| Active tabs refresh | Debounced at 300ms — responds to Chrome tab events without jank |
| Sync write | Non-blocking — runs in a service worker; never delays UI interactions |
| Memory usage | < 50MB in steady state; virtual scrolling for large tab lists (1000+ entries) |
| Storage limit | `unlimitedStorage` permission lifts the default 10MB `chrome.storage.local` quota; writes that still fail surface a typed `QuotaExceededError` |

---

## 17. Error Handling & Edge Cases

- **Drive sync failure:** shows non-intrusive toast notification with retry button; local data always preserved
- **Expired OAuth token:** prompts re-authentication without data loss
- **Tab with no title:** displays URL hostname as title
- **Tab with no favicon:** shows a generic globe icon with the domain's first letter
- **Duplicate URL in same group:** warn on save, allow user to skip or save anyway
- **Import conflict:** offer Merge (add new items) or Replace (overwrite) mode
- **Large group open-all (>20 tabs):** shows confirmation dialog warning about tab count
- **Extension update with schema migration:** automatic migration on load with rollback option if migration fails

---

## 18. Future Roadmap (V2 Considerations)

The following features are intentionally out of scope for V1 but documented here to ensure the V1 architecture does not preclude them:

- **Reminders / scheduled tab opening** — notify user to revisit a saved tab at a specified date/time
- **Shared workspaces** — share a read-only or editable workspace link with another TabNest user
- **Browser history integration** — surface recently visited pages alongside saved tabs
- **Tag system** — cross-category tagging of individual tabs for flexible retrieval
- **Tab screenshots** — capture a thumbnail of a page at save time
- **Firefox / Edge port** — MV3 is compatible with both; sync layer is browser-agnostic
- **Mobile companion app** — view and manage saved tabs on Android/iOS via Drive-backed data
- **AI-powered grouping suggestion** — auto-suggest category/group based on URL domain and title

---

## Appendix: File Structure

```
tabnest/
├── manifest.json          # MV3 manifest
├── src/
│   ├── newtab/            # New tab page React app entry
│   ├── popup/             # Toolbar popup React app entry
│   ├── background/        # Service worker (sync, context menus, tab events)
│   ├── content/           # Content scripts (context menu injection)
│   ├── components/        # Shared React components
│   │   ├── ActiveTabsPanel/
│   │   ├── CategorySidebar/
│   │   ├── GroupCard/
│   │   ├── SearchBar/
│   │   ├── NoteEditor/
│   │   └── Settings/
│   ├── hooks/             # Custom React hooks (useStorage, useSync, useTabs)
│   ├── lib/
│   │   ├── storage.ts     # chrome.storage.local abstraction
│   │   ├── gdrive.ts      # Google Drive API client
│   │   ├── search.ts      # Fuse.js search wrapper
│   │   └── schema.ts      # TypeScript types + Zod validators
│   └── styles/            # Global Tailwind config + CSS variables
├── public/
│   ├── newtab.html
│   ├── popup.html
│   └── icons/
└── vite.config.ts
```
