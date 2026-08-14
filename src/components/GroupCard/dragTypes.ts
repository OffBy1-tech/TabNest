// Shared drag-and-drop payload contract for moving a tab between GroupCards.
// Used by TabRow (drag source) and GroupCard (drop target).

export const DRAG_TYPE = 'application/x-tabnest-tab'

export interface DragPayload {
  tabId: string
  fromGroupId: string
}

// Drag contract for tabs dragged out of the Active Tabs panel (spec §4.2/§5.1).
// Sources: WindowSection rows. Targets: within-window reorder (WindowSection),
// GroupCard (append tab to group), CategoryList rows (save as new group).

export const ACTIVE_TAB_DRAG_TYPE = 'application/x-tabnest-active-tab'

export interface ActiveTabDragPayload {
  tabId: number
  windowId: number
  /** Metadata for save-on-drop targets outside the panel. `| undefined` keeps
   *  chrome.tabs.Tab's optional fields assignable under exactOptionalPropertyTypes. */
  url?: string | undefined
  title?: string | undefined
  favIconUrl?: string | undefined
}
