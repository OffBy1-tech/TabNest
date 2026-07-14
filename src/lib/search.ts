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
  /** Epoch ms used for date filtering/sorting: tab saved_at or group created_at. */
  timestamp?: number
}

// ---------------------------------------------------------------------------
// Filters & sorting (spec §8.3)
// ---------------------------------------------------------------------------

export type SearchDateRange = 'any' | 'day' | 'week' | 'month'
export type SearchSort = 'relevance' | 'newest' | 'oldest' | 'az'

export interface SearchFilters {
  /** Restrict to a single workspace ('' = all). */
  workspaceId: string
  /** Restrict to a single category ('' = all). */
  categoryId: string
  /** Record types to include (empty set = all types). */
  types: ReadonlySet<SearchRecord['type']>
  dateRange: SearchDateRange
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  workspaceId: '',
  categoryId: '',
  types: new Set(),
  dateRange: 'any',
}

const DATE_RANGE_MS: Record<Exclude<SearchDateRange, 'any'>, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

/**
 * Apply chip filters to a result list. A date range only keeps records that
 * carry a timestamp (tabs, groups) within the window.
 */
export function filterRecords(
  records: SearchRecord[],
  filters: SearchFilters,
  now: number = Date.now(),
): SearchRecord[] {
  return records.filter((r) => {
    if (filters.workspaceId && r.workspace_id !== filters.workspaceId) return false
    if (filters.categoryId && r.category_id !== filters.categoryId) return false
    if (filters.types.size > 0 && !filters.types.has(r.type)) return false
    if (filters.dateRange !== 'any') {
      if (r.timestamp == null) return false
      if (now - r.timestamp > DATE_RANGE_MS[filters.dateRange]) return false
    }
    return true
  })
}

/**
 * Order results. 'relevance' preserves the engine's ranking; date sorts put
 * records without a timestamp last; 'az' is a locale-aware title sort.
 */
export function sortRecords(records: SearchRecord[], sort: SearchSort): SearchRecord[] {
  if (sort === 'relevance') return records
  const sorted = [...records]
  if (sort === 'az') {
    sorted.sort((a, b) => a.title.localeCompare(b.title))
  } else {
    const dir = sort === 'newest' ? -1 : 1
    sorted.sort((a, b) => {
      if (a.timestamp == null && b.timestamp == null) return 0
      if (a.timestamp == null) return 1
      if (b.timestamp == null) return -1
      return (a.timestamp - b.timestamp) * dir
    })
  }
  return sorted
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
          timestamp: group.created_at,
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
            timestamp: tab.saved_at,
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
