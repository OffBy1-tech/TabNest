/**
 * search.ts
 * Fuse.js search wrapper for tabNest.
 *
 * Indexes only structural metadata (title, url, group_name).
 * Note content is deliberately excluded from the index — notes can contain
 * sensitive personal information and should not be surfaced in search results.
 */

import Fuse from 'fuse.js'
import type { Workspace } from './schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchRecord {
  /** Unique identifier for the record — tabs use SavedTab.id, groups use TabGroup.id, etc. */
  id: string
  type: 'tab' | 'group' | 'category' | 'workspace'
  title: string
  url?: string
  group_name?: string
  workspace_name: string
  category_name: string
  /** Human-readable location path e.g. "My Workspace > Work > Research" */
  breadcrumb: string
  workspace_id: string
  category_id?: string
  group_id?: string
}

// ---------------------------------------------------------------------------
// Index builder
// ---------------------------------------------------------------------------

/**
 * Flatten the full workspace tree into a 1-D array of SearchRecord objects.
 * Called when data loads or changes; pass the result to createSearchEngine().
 */
export function buildSearchIndex(workspaces: Workspace[]): SearchRecord[] {
  const records: SearchRecord[] = []

  for (const workspace of workspaces) {
    // Workspace-level record
    records.push({
      id: workspace.id,
      type: 'workspace',
      title: workspace.name,
      workspace_name: workspace.name,
      category_name: '',
      breadcrumb: workspace.name,
      workspace_id: workspace.id,
    })

    for (const category of workspace.categories) {
      // Category-level record
      records.push({
        id: category.id,
        type: 'category',
        title: category.name,
        workspace_name: workspace.name,
        category_name: category.name,
        breadcrumb: `${workspace.name} > ${category.name}`,
        workspace_id: workspace.id,
        category_id: category.id,
      })

      for (const group of category.groups) {
        const groupBreadcrumb = `${workspace.name} > ${category.name} > ${group.name}`

        // Group-level record
        records.push({
          id: group.id,
          type: 'group',
          title: group.name,
          group_name: group.name,
          workspace_name: workspace.name,
          category_name: category.name,
          breadcrumb: groupBreadcrumb,
          workspace_id: workspace.id,
          category_id: category.id,
          group_id: group.id,
        })

        // Tab-level records — note content intentionally omitted
        for (const tab of group.tabs) {
          records.push({
            id: tab.id,
            type: 'tab',
            title: tab.title,
            url: tab.url,
            group_name: group.name,
            workspace_name: workspace.name,
            category_name: category.name,
            breadcrumb: groupBreadcrumb,
            workspace_id: workspace.id,
            category_id: category.id,
            group_id: group.id,
          })
        }
      }
    }
  }

  return records
}

// ---------------------------------------------------------------------------
// Search engine factory
// ---------------------------------------------------------------------------

/**
 * Build a configured Fuse instance from a pre-built index.
 * Re-create this when the workspace data changes.
 */
export function createSearchEngine(records: SearchRecord[]): Fuse<SearchRecord> {
  return new Fuse(records, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'url', weight: 0.3 },
      { name: 'group_name', weight: 0.2 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
    // Disable location-based scoring — tab titles can be any length
    ignoreLocation: true,
    // Do not include match indices in results — keeps payload light
    includeMatches: false,
  })
}

// ---------------------------------------------------------------------------
// Search execution
// ---------------------------------------------------------------------------

/**
 * Run a fuzzy query against the engine, returning at most `limit` records.
 * Results are ordered by Fuse's internal relevance score (lower = better).
 */
export function search(
  engine: Fuse<SearchRecord>,
  query: string,
  limit = 50,
): SearchRecord[] {
  if (query.trim().length === 0) return []

  const results = engine.search(query, { limit })

  // Map from Fuse result wrapper to plain SearchRecord
  return results.map((r) => r.item)
}
