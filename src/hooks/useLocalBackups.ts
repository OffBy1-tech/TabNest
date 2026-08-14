import { useEffect, useState } from 'react'
import { readLocalBackups, subscribeToBackupsChange } from '../lib/storage'
import type { BackupGeneration } from '../lib/schema'

/**
 * Live view of the local backup generations (device-only key owned by
 * lib/storage). Updates straight from the change event's payload — e.g. a
 * background sync pushing a new pre-overwrite snapshot while Settings is
 * open. Resolves to [] in non-extension contexts (dev server, storybook).
 */
export function useLocalBackups(): BackupGeneration[] {
  const [backups, setBackups] = useState<BackupGeneration[]>([])

  useEffect(() => {
    readLocalBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
    return subscribeToBackupsChange((change) => {
      setBackups((change.newValue as BackupGeneration[] | undefined) ?? [])
    })
  }, [])

  return backups
}
