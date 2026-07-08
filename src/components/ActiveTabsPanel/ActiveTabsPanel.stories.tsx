import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import type { Workspace } from '../../lib/schema';
import { ActiveTabsPanel } from './ActiveTabsPanel';

const meta = {
  title: 'Components/ActiveTabsPanel',
  component: ActiveTabsPanel,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ActiveTabsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Mock workspace
// ---------------------------------------------------------------------------

const NOW = Date.now();

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Personal',
    created_at: NOW - 86400000 * 30,
    categories: [
      {
        id: 'cat-1',
        name: 'Work',
        color: '#1A56DB',
        emoji: '💼',
        collapsed: false,
        order: 0,
        groups: [
          {
            id: 'grp-1',
            name: 'Research',
            created_at: NOW,
            updated_at: NOW,
            order: 0,
            notes: [],
            tabs: [],
          },
          {
            id: 'grp-2',
            name: 'Design',
            created_at: NOW,
            updated_at: NOW,
            order: 1,
            notes: [],
            tabs: [],
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Personal',
        color: '#16a34a',
        emoji: '🏠',
        collapsed: false,
        order: 1,
        groups: [],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mock chrome tabs for populated stories
// ---------------------------------------------------------------------------

function makeMockTab(
  id: number,
  title: string,
  url: string,
  favIconUrl?: string,
): chrome.tabs.Tab {
  return {
    id,
    title,
    url,
    favIconUrl,
    index: id,
    windowId: 1,
    highlighted: false,
    active: id === 1,
    pinned: false,
    incognito: false,
    selected: id === 1,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
  } as chrome.tabs.Tab;
}

const mockTabsWindow1: chrome.tabs.Tab[] = [
  makeMockTab(1, 'GitHub — Build software better, together', 'https://github.com', 'https://github.com/favicon.ico'),
  makeMockTab(2, 'React — The library for web and native user interfaces', 'https://react.dev', 'https://react.dev/favicon.ico'),
  makeMockTab(3, 'TypeScript: JavaScript With Syntax For Types', 'https://www.typescriptlang.org', 'https://www.typescriptlang.org/favicon-32x32.png'),
  makeMockTab(4, 'Hacker News', 'https://news.ycombinator.com'),
  makeMockTab(5, 'Stack Overflow — Where Developers Learn, Share, & Build Careers', 'https://stackoverflow.com', 'https://stackoverflow.com/favicon.ico'),
];

const mockTabsWindow2: chrome.tabs.Tab[] = [
  makeMockTab(10, 'Gmail — Inbox', 'https://mail.google.com', 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'),
  makeMockTab(11, 'Google Calendar', 'https://calendar.google.com'),
];

// ---------------------------------------------------------------------------
// Decorator to inject mock chrome.windows.getAll for specific stories
// ---------------------------------------------------------------------------

function withMockWindows(
  mockWindows: Array<{ id: number; tabs: chrome.tabs.Tab[] }>,
): (Story: React.ComponentType) => React.JSX.Element {
  return function MockWindowsDecorator(Story: React.ComponentType): React.JSX.Element {
    useEffect(() => {
      const original = (globalThis as Record<string, unknown>).chrome;

      const patched = {
        ...(original as object),
        windows: {
          getAll: (_getInfo: object, callback?: (windows: chrome.windows.Window[]) => void) => {
            if (typeof callback === 'function') {
              callback(
                mockWindows.map((w) => ({
                  id: w.id,
                  tabs: w.tabs,
                  focused: false,
                  alwaysOnTop: false,
                  incognito: false,
                  state: 'normal' as const,
                  type: 'normal' as const,
                })),
              );
            }
          },
          onFocusChanged: { addListener: () => {}, removeListener: () => {} },
        },
      };

      (globalThis as Record<string, unknown>).chrome = patched;

      return () => {
        (globalThis as Record<string, unknown>).chrome = original;
      };
    }, []);

    return (
      <div style={{ width: 320, height: 600, position: 'relative' }}>
        <Story />
      </div>
    );
  };
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const EmptyNoTabs: Story = {
  args: {
    onSaveTab: (tab, groupName, categoryId, workspaceId) =>
      console.log('save tab', tab.title, groupName, categoryId, workspaceId),
    onSaveWindowTabs: (tabs, groupName) => console.log('save window', tabs.length, groupName),
    onCloseTab: (tabId) => console.log('close tab', tabId),
    workspaces: mockWorkspaces,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, height: 600, position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};

export const SingleWindowWithTabs: Story = {
  args: {
    onSaveTab: (tab, groupName, categoryId, workspaceId) =>
      console.log('save tab', tab.title, groupName, categoryId, workspaceId),
    onSaveWindowTabs: (tabs, groupName) => console.log('save window', tabs.length, groupName),
    onCloseTab: (tabId) => console.log('close tab', tabId),
    workspaces: mockWorkspaces,
  },
  decorators: [withMockWindows([{ id: 1, tabs: mockTabsWindow1 }])],
};

export const MultipleWindows: Story = {
  args: {
    onSaveTab: (tab, groupName, categoryId, workspaceId) =>
      console.log('save tab', tab.title, groupName, categoryId, workspaceId),
    onSaveWindowTabs: (tabs, groupName) => console.log('save window', tabs.length, groupName),
    onCloseTab: (tabId) => console.log('close tab', tabId),
    workspaces: mockWorkspaces,
  },
  decorators: [
    withMockWindows([
      { id: 1, tabs: mockTabsWindow1 },
      { id: 2, tabs: mockTabsWindow2 },
    ]),
  ],
};

export const NoWorkspaces: Story = {
  args: {
    onSaveTab: () => {},
    onSaveWindowTabs: () => {},
    onCloseTab: () => {},
    workspaces: [],
  },
  decorators: [withMockWindows([{ id: 1, tabs: mockTabsWindow1 }])],
};
