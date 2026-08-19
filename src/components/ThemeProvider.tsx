import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { readStorage, patchSettings, subscribeToStorageChange } from '../lib/storage';
import { isThemePreference, type UserSettings } from '../lib/schema';
export type ThemePreference = UserSettings['theme'];
interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** The resolved theme actually applied to the document ('light' | 'dark'). */
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The synced settings.theme is the single source of truth. This key is only a
 * localStorage fallback for non-extension contexts (Vitest / Storybook / dev
 * server) where chrome.storage is unavailable.
 */
const LOCAL_FALLBACK_KEY = 'tabnest_theme';
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

  // Apply a preference to React state and the document, without persisting.
  // Used for the initial load and for changes arriving from storage (another
  // tab, another device via Drive sync) — persisting there would loop.
  const applyPreference = useCallback((next: ThemePreference) => {
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, []);

  // Apply a user-chosen preference and persist it to settings.theme.
  const setTheme = useCallback((next: ThemePreference) => {
    applyPreference(next);
    patchSettings({ theme: next }).catch(() => {
      // Non-extension context (Vitest / Storybook) — persist locally instead
      try {
        localStorage.setItem(LOCAL_FALLBACK_KEY, next);
      } catch {
        // Storage entirely unavailable — the choice still applies this session
      }
    });
  }, [applyPreference]);

  // On mount: read the stored preference, apply it, then follow storage and
  // OS-level changes.
  useEffect(() => {
    let cancelled = false;
    async function init(): Promise<void> {
      let saved: ThemePreference | null = null;
      try {
        const data = await readStorage();
        if (isThemePreference(data.settings.theme)) {
          saved = data.settings.theme;
        }
      } catch {
        // Non-extension context — fall back to localStorage
        try {
          const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
          if (isThemePreference(raw)) saved = raw;
        } catch {
          // No storage available
        }
      }

      if (cancelled) return;
      applyPreference(saved ?? defaultTheme);
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

    // Follow settings.theme changes written elsewhere (another extension
    // page, or a Drive sync applying another device's choice).
    const unsubscribe = subscribeToStorageChange((change) => {
      type ThemeShape = { settings?: { theme?: unknown } };
      const oldTheme = (change.oldValue as ThemeShape | undefined)?.settings?.theme;
      const newTheme = (change.newValue as ThemeShape | undefined)?.settings?.theme;
      if (newTheme !== oldTheme && isThemePreference(newTheme)) {
        applyPreference(newTheme);
      }
    });
    return () => {
      cancelled = true;
      mediaQuery.removeEventListener('change', handleOsChange);
      unsubscribe();
    };
  }, [defaultTheme, applyPreference]);
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
