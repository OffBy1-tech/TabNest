import { describe, it, expect, vi, afterEach } from 'vitest'
import { openTab } from './openTab'

describe('openTab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as { chrome?: unknown }).chrome
  })

  it('opens a new tab via window.open for the default behavior', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openTab('https://example.com', 'new_tab')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })

  it('opens a real window via chrome.windows.create for new_window', () => {
    const create = vi.fn()
    ;(globalThis as { chrome?: unknown }).chrome = { windows: { create } }
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openTab('https://example.com', 'new_window')
    expect(create).toHaveBeenCalledWith({ url: 'https://example.com' })
    expect(open).not.toHaveBeenCalled()
  })

  it('falls back to window.open for new_window outside an extension context', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openTab('https://example.com', 'new_window')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })
})
