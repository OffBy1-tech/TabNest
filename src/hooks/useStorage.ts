import { useCallback, useEffect, useState } from 'react';
import { readStorage, subscribeToStorageChange } from '../lib/storage';
import type { StorageSchema } from '../lib/schema';
export function useStorage(): {
  data: StorageSchema | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<StorageSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refetch = useCallback(async (): Promise<void> => {
    try {
      const result = await readStorage();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const result = await readStorage();
        if (!cancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    void load();
    const unsubscribe = subscribeToStorageChange(() => {
      void refetch();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refetch]);
  return { data, loading, error, refetch };
}
