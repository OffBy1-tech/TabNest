import { describe, it, expect } from 'vitest'
import { pushRecentGroup, MAX_RECENT, type RecentGroup } from './popupStorage'

function rg(groupId: string, categoryId = 'cat', workspaceId = 'ws'): RecentGroup {
  return { groupId, groupName: groupId, categoryId, workspaceId }
}

describe('pushRecentGroup', () => {
  it('prepends the newest entry', () => {
    const result = pushRecentGroup([rg('a')], rg('b'))
    expect(result.map((g) => g.groupId)).toEqual(['b', 'a'])
  })

  it('dedupes by group+category, moving the existing entry to the front', () => {
    const result = pushRecentGroup([rg('a'), rg('b')], rg('a'))
    expect(result.map((g) => g.groupId)).toEqual(['a', 'b'])
  })

  it('treats the same group in a different category as distinct', () => {
    const result = pushRecentGroup([rg('a', 'cat-1')], rg('a', 'cat-2'))
    expect(result).toHaveLength(2)
  })

  it(`caps the list at MAX_RECENT (${MAX_RECENT})`, () => {
    let list: RecentGroup[] = []
    for (const id of ['a', 'b', 'c', 'd', 'e']) list = pushRecentGroup(list, rg(id))
    expect(list).toHaveLength(MAX_RECENT)
    expect(list.map((g) => g.groupId)).toEqual(['e', 'd', 'c'])
  })
})
