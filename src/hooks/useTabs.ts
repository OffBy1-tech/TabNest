import type { SavedTab } from '../lib/schema';
import { sendExtensionMessage } from '../lib/messaging';
export interface SaveTabsParams {
  tabs: SavedTab[];
  group_name: string;
  category_id: string;
  workspace_id: string;
  /** Append to this existing group instead of creating a new one. */
  group_id?: string;
}

async function save(params: SaveTabsParams): Promise<void> {
  const response = await sendExtensionMessage({ type: 'SAVE_TABS', payload: params });
  if (!response.ok) {
    throw new Error(response.error);
  }
}

async function deleteGroup(
  groupId: string,
  categoryId: string,
  workspaceId: string,
): Promise<void> {
  const response = await sendExtensionMessage({
    type: 'DELETE_GROUP',
    payload: {
      group_id: groupId,
      category_id: categoryId,
      workspace_id: workspaceId,
    },
  });
  if (!response.ok) {
    throw new Error(response.error);
  }
}

// Stable at module scope: nothing here is per-render state, and a fresh
// object each call would invalidate every downstream useCallback/useEffect
// that lists `tabs` as a dependency.
const api = { save, delete: deleteGroup };
export function useTabs(): typeof api {
  return api;
}
