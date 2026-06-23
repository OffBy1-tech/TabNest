// Vitest setup for the jsdom unit-test project (see vitest.config.ts).
// Adds jest-dom matchers (toBeInTheDocument, toHaveStyle, …) and ensures the
// React Testing Library DOM is torn down between tests.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement matchMedia; ThemeProvider (and anything that reads the
// OS color-scheme preference) needs it. Provide a minimal stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  cleanup()
  // ThemeProvider persists the chosen theme to localStorage; clear it so a
  // theme change in one test can't leak into another test's initial state.
  try {
    localStorage.clear()
  } catch {
    // localStorage unavailable — nothing to clear
  }
})
