import { useCallback, useEffect, useState } from 'react'
import { readStorage } from '../lib/storage'
import type { StorageSchema } from '../lib/schema'

const STORAGE_KEY = 'tabnest_data'

export function useStorage(): {
  data: StorageSchema | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [data, setData] = useState<StorageSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const result = await readStorage()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const result = await readStorage()
        if (!cancelled) {
          setData(result)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      }
    }

    void load()

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
    ): void {
      if (STORAGE_KEY in changes) {
        void refetch()
      }
    }

    try {
      chrome.storage.local.onChanged.addListener(handleStorageChange)
    } catch {
      // Non-extension context — skip listener setup
    }

    return () => {
      cancelled = true
      try {
        chrome.storage.local.onChanged.removeListener(handleStorageChange)
      } catch {
        // Non-extension context
      }
    }
  }, [refetch])

  return { data, loading, error, refetch }
}
