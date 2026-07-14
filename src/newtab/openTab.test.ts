import { describe, it, expect, vi, afterEach } from 'vitest'
import { openTab, openAllTabs, openAllTabsInBackground } from './openTab'

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

describe('openAllTabs', () => {
  const urls = ['https://a.example/', 'https://b.example/', 'https://c.example/']

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as { chrome?: unknown }).chrome
  })

  it('opens one new window containing all tabs for new_window', () => {
    const create = vi.fn()
    ;(globalThis as { chrome?: unknown }).chrome = { windows: { create } }
    openAllTabs(urls, 'new_window')
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ url: urls })
  })

  it('adds every tab to the current window for current (not just the last one)', () => {
    const create = vi.fn()
    ;(globalThis as { chrome?: unknown }).chrome = { tabs: { create } }
    openAllTabs(urls, 'current')
    expect(create).toHaveBeenCalledTimes(3)
    for (const url of urls) {
      expect(create).toHaveBeenCalledWith({ url, active: false })
    }
  })

  it('opens one tab per URL via window.open for the default behavior', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openAllTabs(urls, 'new_tab')
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('falls back to window.open outside an extension context', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openAllTabs(urls, 'current')
    expect(open).toHaveBeenCalledTimes(3)
    open.mockClear()
    openAllTabs(urls, 'new_window')
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('does nothing for an empty URL list', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openAllTabs([], 'new_tab')
    expect(open).not.toHaveBeenCalled()
  })
})

describe('openAllTabsInBackground', () => {
  const urls = ['https://a.example/', 'https://b.example/']

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as { chrome?: unknown }).chrome
  })

  it('opens one unfocused window containing all tabs', () => {
    const create = vi.fn()
    ;(globalThis as { chrome?: unknown }).chrome = { windows: { create } }
    openAllTabsInBackground(urls)
    expect(create).toHaveBeenCalledWith({ url: urls, focused: false })
  })

  it('falls back to window.open outside an extension context', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openAllTabsInBackground(urls)
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('does nothing for an empty URL list', () => {
    const create = vi.fn()
    ;(globalThis as { chrome?: unknown }).chrome = { windows: { create } }
    openAllTabsInBackground([])
    expect(create).not.toHaveBeenCalled()
  })
})
