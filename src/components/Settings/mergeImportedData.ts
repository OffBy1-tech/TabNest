import type { StorageSchema } from '../../lib/schema'

/**
 * Merge an imported export into the current data without clobbering it.
 *
 * Workspaces and categories are matched case-insensitively by name; matches are
 * merged (incoming groups appended), and anything unmatched is added fresh. All
 * imported workspace/category/group/tab/note ids are regenerated so they can't
 * collide with existing local ids.
 */
export function mergeImportedData(current: StorageSchema, incoming: StorageSchema): StorageSchema {
  const resultWorkspaces = [...current.workspaces]

  for (const incomingWs of incoming.workspaces) {
    const existingWsIdx = resultWorkspaces.findIndex(
      ws => ws.name.toLowerCase() === incomingWs.name.toLowerCase(),
    )

    if (existingWsIdx >= 0) {
      const existingWs = resultWorkspaces[existingWsIdx]!
      const mergedCats = [...existingWs.categories]

      for (const incomingCat of incomingWs.categories) {
        const existingCatIdx = mergedCats.findIndex(
          cat => cat.name.toLowerCase() === incomingCat.name.toLowerCase(),
        )

        if (existingCatIdx >= 0) {
          const existingCat = mergedCats[existingCatIdx]!
          const nextOrder = existingCat.groups.length
          const freshGroups = incomingCat.groups.map((g, i) => ({
            ...g,
            id: crypto.randomUUID(),
            order: nextOrder + i,
            tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
            notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
          }))
          mergedCats[existingCatIdx] = {
            ...existingCat,
            groups: [...existingCat.groups, ...freshGroups],
          }
        } else {
          mergedCats.push({
            ...incomingCat,
            id: crypto.randomUUID(),
            order: mergedCats.length,
            groups: incomingCat.groups.map((g, i) => ({
              ...g,
              id: crypto.randomUUID(),
              order: i,
              tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
              notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
            })),
          })
        }
      }

      resultWorkspaces[existingWsIdx] = { ...existingWs, categories: mergedCats }
    } else {
      resultWorkspaces.push({
        ...incomingWs,
        id: crypto.randomUUID(),
        categories: incomingWs.categories.map((cat, ci) => ({
          ...cat,
          id: crypto.randomUUID(),
          order: ci,
          groups: cat.groups.map((g, i) => ({
            ...g,
            id: crypto.randomUUID(),
            order: i,
            tabs: g.tabs.map(t => ({ ...t, id: crypto.randomUUID() })),
            notes: g.notes.map(n => ({ ...n, id: crypto.randomUUID() })),
          })),
        })),
      })
    }
  }

  return { ...current, workspaces: resultWorkspaces }
}
