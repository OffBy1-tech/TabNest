import type { Meta, StoryObj } from '@storybook/react-vite';
import { TopBar } from './TopBar';

const meta = {
  title: 'Components/TopBar',
  component: TopBar,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  onSearch: () => console.log('search opened'),
  onActiveTabsToggle: () => console.log('active tabs toggled'),
  onSettingsClick: () => console.log('settings opened'),
};

export const Idle: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: false,
    syncState: 'idle',
    lastSyncAt: Date.now() - 60000, // 1 minute ago
  },
};

export const ActiveTabsOpen: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: true,
    syncState: 'idle',
    lastSyncAt: Date.now() - 120000,
  },
};

export const Syncing: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: false,
    syncState: 'syncing',
    lastSyncAt: Date.now() - 300000,
  },
};

export const SyncError: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: false,
    syncState: 'error',
    lastSyncAt: 0,
  },
};

export const NeverSynced: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: false,
    syncState: 'idle',
    lastSyncAt: 0,
  },
};

export const WithClock: Story = {
  args: {
    ...baseArgs,
    activeTabsOpen: false,
    syncState: 'idle',
    lastSyncAt: Date.now(),
    showClock: true,
  },
};
