import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { ThemeProvider } from '../src/components/ThemeProvider';
import '../src/styles/globals.css';

// ---------------------------------------------------------------------------
// Chrome API stub — prevents crashes in any component that calls chrome.*
// ---------------------------------------------------------------------------

type StorageData = Record<string, unknown>;

const _storageData: StorageData = {};

const chromeMock = {
  storage: {
    local: {
      get: (keys: string | string[] | StorageData | null, callback?: (result: StorageData) => void): Promise<StorageData> => {
        const result: StorageData = {};
        const keyList = Array.isArray(keys)
          ? keys
          : typeof keys === 'string'
          ? [keys]
          : keys !== null
          ? Object.keys(keys)
          : Object.keys(_storageData);
        for (const k of keyList) {
          if (k in _storageData) result[k] = _storageData[k];
        }
        if (typeof callback === 'function') callback(result);
        return Promise.resolve(result);
      },
      set: (items: StorageData, callback?: () => void): Promise<void> => {
        Object.assign(_storageData, items);
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      remove: (keys: string | string[], callback?: () => void): Promise<void> => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete _storageData[k];
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      clear: (callback?: () => void): Promise<void> => {
        Object.keys(_storageData).forEach((k) => delete _storageData[k]);
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    sync: {
      get: (_keys: unknown, callback?: (result: StorageData) => void): Promise<StorageData> => {
        if (typeof callback === 'function') callback({});
        return Promise.resolve({});
      },
      set: (_items: StorageData, callback?: () => void): Promise<void> => {
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  runtime: {
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
  tabs: {
    query: (_queryInfo: object, callback?: (tabs: chrome.tabs.Tab[]) => void): Promise<chrome.tabs.Tab[]> => {
      if (typeof callback === 'function') callback([]);
      return Promise.resolve([]);
    },
    create: (_createProperties: object, callback?: (tab: chrome.tabs.Tab) => void): Promise<chrome.tabs.Tab> => {
      const tab = {} as chrome.tabs.Tab;
      if (typeof callback === 'function') callback(tab);
      return Promise.resolve(tab);
    },
    update: (_tabId: number, _updateProperties: object, callback?: (tab?: chrome.tabs.Tab) => void): Promise<chrome.tabs.Tab | undefined> => {
      if (typeof callback === 'function') callback(undefined);
      return Promise.resolve(undefined);
    },
    onCreated: { addListener: () => {}, removeListener: () => {} },
    onRemoved: { addListener: () => {}, removeListener: () => {} },
    onUpdated: { addListener: () => {}, removeListener: () => {} },
  },
  windows: {
    getAll: (_getInfo: object, callback?: (windows: chrome.windows.Window[]) => void): void => {
      if (typeof callback === 'function') callback([]);
    },
    getCurrent: (_getInfo: object, callback?: (window: chrome.windows.Window) => void): Promise<chrome.windows.Window> => {
      const win = {} as chrome.windows.Window;
      if (typeof callback === 'function') callback(win);
      return Promise.resolve(win);
    },
    onFocusChanged: { addListener: () => {}, removeListener: () => {} },
  },
  identity: {
    getAuthToken: (_details: object, callback?: (token?: string) => void): Promise<string> => {
      if (typeof callback === 'function') callback(undefined);
      return Promise.resolve('');
    },
    removeCachedAuthToken: (_details: object, callback?: () => void): Promise<void> => {
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },
  },
};

// Attach to globalThis so any component referencing `chrome.*` gets the stub
if (typeof globalThis.chrome === 'undefined') {
  (globalThis as Record<string, unknown>).chrome = chromeMock;
}

// ---------------------------------------------------------------------------
// Global Storybook preview config
// ---------------------------------------------------------------------------

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
