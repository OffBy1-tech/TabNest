import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** The resolved theme actually applied to the document ('light' | 'dark'). */
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'tabnest_theme';

function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? getSystemPreference() : preference;
}

function applyThemeToDocument(resolved: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Default theme preference used before the stored value is read.
   * Defaults to 'system' so the OS preference is respected on first load.
   */
  defaultTheme?: ThemePreference;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemePreference>(defaultTheme);

  // Resolved ('light' | 'dark') derived from current preference + OS state
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(
    () => resolveTheme(defaultTheme),
  );

  // Apply a new theme preference, persist it, and update the document
  const setTheme = useCallback((next: ThemePreference) => {
    const resolved = resolveTheme(next);
    setThemeState(next);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);

    // Persist to chrome.storage.local (best-effort — graceful in non-extension contexts)
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: next });
    } catch {
      // Running outside the extension context (e.g. Vitest / Storybook)
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage entirely unavailable — continue silently
      }
    }
  }, []);

  // On mount: read stored preference, apply immediately, then set up OS listener
  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      let saved: ThemePreference | null = null;

      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const raw = (result as Record<string, unknown>)[STORAGE_KEY];
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          saved = raw;
        }
      } catch {
        // Fallback to localStorage for non-extension environments
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw === 'light' || raw === 'dark' || raw === 'system') {
            saved = raw;
          }
        } catch {
          // No storage available
        }
      }

      if (cancelled) return;

      const preference = saved ?? defaultTheme;
      const resolved = resolveTheme(preference);
      setThemeState(preference);
      setResolvedTheme(resolved);
      applyThemeToDocument(resolved);
    }

    void init();

    // Listen for OS-level color scheme changes (only matters when preference is 'system')
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function handleOsChange(): void {
      // Only re-resolve if the user's preference is 'system'
      setThemeState((current) => {
        if (current === 'system') {
          const resolved = getSystemPreference();
          setResolvedTheme(resolved);
          applyThemeToDocument(resolved);
        }
        return current;
      });
    }

    mediaQuery.addEventListener('change', handleOsChange);

    // Also watch for Drive-synced theme changes via storage events
    let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | null = null
    try {
      storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area !== 'local') return
        const dataChange = changes['tabnest_data']
        if (!dataChange?.newValue) return
        type ThemeShape = { settings?: { theme?: string } }
        const oldTheme = (dataChange.oldValue as ThemeShape | undefined)?.settings?.theme
        const newTheme = (dataChange.newValue as ThemeShape | undefined)?.settings?.theme
        if (newTheme !== oldTheme && (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system')) {
          setTheme(newTheme)
        }
      }
      chrome.storage.onChanged.addListener(storageListener)
    } catch {
      // Non-extension context
    }

    return () => {
      cancelled = true;
      mediaQuery.removeEventListener('change', handleOsChange);
      try {
        if (storageListener) chrome.storage.onChanged.removeListener(storageListener)
      } catch {
        // Non-extension context
      }
    };
  }, [defaultTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to consume the theme context. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
