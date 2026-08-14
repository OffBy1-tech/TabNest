import { useCallback, useEffect, useRef, useState } from 'react'

export interface WindowWithTabs {
  windowId: number
  tabs: chrome.tabs.Tab[]
}

/**
 * Subscribes to the browser's open windows/tabs and returns them grouped by
 * window. Refreshes (debounced) on tab create/remove/update/move. Returns an
 * empty list outside an extension context.
 */
export function useActiveTabs(): WindowWithTabs[] {
  const [windows, setWindows] = useState<WindowWithTabs[]>([])
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback((): void => {
    try {
      chrome.windows.getAll({ populate: true }, (chromeWindows) => {
        const grouped: WindowWithTabs[] = chromeWindows
          .filter((w) => (w.tabs?.length ?? 0) > 0)
          .map((w) => ({ windowId: w.id ?? 0, tabs: w.tabs ?? [] }))
        setWindows(grouped)
      })
    } catch {
      // Non-extension context — leave windows empty
    }
  }, [])

  const scheduleRefresh = useCallback((): void => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      refresh()
      debounceTimer.current = null
    }, 300)
  }, [refresh])

  useEffect(() => {
    refresh()

    let listeners: (() => void) | null = null

    try {
      function onCreated(): void {
        scheduleRefresh()
      }
      function onRemoved(): void {
        scheduleRefresh()
      }
      function onUpdated(): void {
        scheduleRefresh()
      }

      function onMoved(): void {
        scheduleRefresh()
      }

      chrome.tabs.onCreated.addListener(onCreated)
      chrome.tabs.onRemoved.addListener(onRemoved)
      chrome.tabs.onUpdated.addListener(onUpdated)
      chrome.tabs.onMoved.addListener(onMoved)

      listeners = () => {
        chrome.tabs.onCreated.removeListener(onCreated)
        chrome.tabs.onRemoved.removeListener(onRemoved)
        chrome.tabs.onUpdated.removeListener(onUpdated)
        chrome.tabs.onMoved.removeListener(onMoved)
      }
    } catch {
      // Non-extension context
    }

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current)
      }
      listeners?.()
    }
  }, [refresh, scheduleRefresh])

  return windows
}
