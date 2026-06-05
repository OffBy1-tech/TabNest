import type { SavedTab, MessageResponse } from '../lib/schema'

export interface SaveTabsParams {
  tabs: SavedTab[]
  group_name: string
  category_id: string
  workspace_id: string
}

export function useTabs(): {
  save: (params: SaveTabsParams) => Promise<void>
  delete: (groupId: string, categoryId: string, workspaceId: string) => Promise<void>
} {
  async function save(params: SaveTabsParams): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_TABS',
      payload: params,
    }) as MessageResponse<unknown>

    if (!response.ok) {
      throw new Error(response.error)
    }
  }

  async function deleteGroup(
    groupId: string,
    categoryId: string,
    workspaceId: string,
  ): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_GROUP',
      payload: {
        group_id: groupId,
        category_id: categoryId,
        workspace_id: workspaceId,
      },
    }) as MessageResponse<unknown>

    if (!response.ok) {
      throw new Error(response.error)
    }
  }

  return { save, delete: deleteGroup }
}
