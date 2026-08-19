/**
 * Shared schema-entity builders for tests and stories.
 *
 * Minimal valid shapes with fixed timestamps — override the fields a test
 * cares about. Ids are plain strings (not UUIDs), so these are for code that
 * doesn't Zod-validate; tests exercising validation (storage.test.ts) build
 * their own UUID-bearing fixtures.
 */

import type { SavedTab, Note, TabGroup, Category, Workspace, TrashItem } from './schema';
export const tab = (id: string, o: Partial<SavedTab> = {}): SavedTab => ({
  id, title: id, url: `https://${id}.test`, saved_at: 1, ...o,
});
export const note = (id: string, o: Partial<Note> = {}): Note => ({
  id, content: id, created_at: 1, updated_at: 1, ...o,
});
export const group = (id: string, o: Partial<TabGroup> = {}): TabGroup => ({
  id, name: id, created_at: 1, updated_at: 1, order: 0, tabs: [], notes: [], ...o,
});
export const category = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, color: '#6366f1', emoji: '📁', collapsed: false, order: 0, groups: [], notes: [], ...o,
});
export const workspace = (id: string, categories: Category[] = [], o: Partial<Workspace> = {}): Workspace => ({
  id, name: id, created_at: 1, categories, ...o,
});
export const trashItem = (id: string, o: Partial<TrashItem> = {}): TrashItem => ({
  id, type: 'group', data: {}, original_location: { workspace_id: 'ws' }, deleted_at: 1, ...o,
});
