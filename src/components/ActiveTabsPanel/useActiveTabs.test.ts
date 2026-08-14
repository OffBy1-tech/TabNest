import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useActiveTabs } from './useActiveTabs'

describe('useActiveTabs', () => {
  it('returns an empty list outside an extension context (no chrome.*)', () => {
    // jsdom has no global `chrome`, so the hook swallows the error and stays empty.
    const { result } = renderHook(() => useActiveTabs())
    expect(result.current).toEqual([])
  })
})
