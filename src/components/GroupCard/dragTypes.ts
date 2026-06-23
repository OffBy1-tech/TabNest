// Shared drag-and-drop payload contract for moving a tab between GroupCards.
// Used by TabRow (drag source) and GroupCard (drop target).

export const DRAG_TYPE = 'application/x-tabnest-tab'

export interface DragPayload {
  tabId: string
  fromGroupId: string
}
