import type { Meta, StoryObj } from '@storybook/react-vite';
import type { UserSettings, LocalSettings, SyncMeta, Workspace, TrashItem } from '../../lib/schema';
import { SettingsModal } from './SettingsModal';

const meta = {
  title: 'Components/SettingsModal',
  component: SettingsModal,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SettingsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const NOW = Date.now();

const defaultSettings: UserSettings = {
  theme: 'light',
  default_view: 'grid',
  open_tab_behavior: 'new_tab',
  save_and_close: false,
  show_favicons: true,
  compact_mode: false,
  active_tabs_on_load: true,
  default_workspace_id: 'ws-1',
  show_clock: true,
};

const defaultLocalSettings: LocalSettings = {
  sync_enabled: false,
  sync_interval_minutes: 15,
};

const syncMeta: SyncMeta = {
  drive_file_id: null,
  last_sync_at: 0,
  last_modified_at: NOW - 3600000,
  device_id: 'device-abc123',
  sync_state: 'idle',
  pending_sync: false,
  error_message: null,
  retry_count: 0,
};

const syncMetaConnected: SyncMeta = {
  ...syncMeta,
  drive_file_id: 'drive-file-xyz',
  last_sync_at: NOW - 300000,
  sync_state: 'idle',
};

const syncMetaError: SyncMeta = {
  ...syncMeta,
  sync_state: 'error',
  error_message: 'Failed to authenticate with Google Drive. Please reconnect.',
  retry_count: 3,
};

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
        ],
      },
    ],
  },
  {
    id: 'ws-2',
    name: 'Work',
    created_at: NOW - 86400000 * 7,
    categories: [],
  },
];

const mockTrashItems: TrashItem[] = [
  {
    id: 'trash-1',
    type: 'group',
    data: { id: 'grp-deleted', name: 'Old Research', tabs: [] },
    original_location: {
      workspace_id: 'ws-1',
      category_id: 'cat-1',
    },
    deleted_at: NOW - 86400000 * 2,
  },
  {
    id: 'trash-2',
    type: 'tab',
    data: {
      id: 'tab-deleted',
      title: 'Some deleted tab',
      url: 'https://example.com/deleted',
      saved_at: NOW - 86400000 * 3,
    },
    original_location: {
      workspace_id: 'ws-1',
      category_id: 'cat-1',
      group_id: 'grp-1',
    },
    deleted_at: NOW - 86400000,
  },
];

const sharedArgs = {
  isOpen: true,
  onClose: () => console.log('close settings'),
  onSave: (s: UserSettings) => console.log('save settings', s),
  localSettings: defaultLocalSettings,
  onSaveLocalSettings: (patch: Partial<LocalSettings>) => console.log('save local settings', patch),
  onRestoreTrashItem: (id: string) => console.log('restore', id),
  onDeleteTrashItem: (id: string) => console.log('delete trash', id),
  onEmptyTrash: () => console.log('empty trash'),
  onShowOnboarding: () => console.log('show onboarding'),
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const GeneralTab: Story = {
  args: {
    ...sharedArgs,
    settings: defaultSettings,
    syncMeta,
    workspaces: mockWorkspaces,
    trashItems: [],
  },
};

export const SyncConnected: Story = {
  args: {
    ...sharedArgs,
    settings: defaultSettings,
    localSettings: { ...defaultLocalSettings, sync_enabled: true },
    syncMeta: syncMetaConnected,
    workspaces: mockWorkspaces,
    trashItems: [],
  },
};

export const SyncError: Story = {
  args: {
    ...sharedArgs,
    settings: defaultSettings,
    localSettings: { ...defaultLocalSettings, sync_enabled: true },
    syncMeta: syncMetaError,
    workspaces: mockWorkspaces,
    trashItems: [],
  },
};

export const WithTrashItems: Story = {
  args: {
    ...sharedArgs,
    settings: defaultSettings,
    syncMeta,
    workspaces: mockWorkspaces,
    trashItems: mockTrashItems,
  },
};

export const NoWorkspaces: Story = {
  args: {
    ...sharedArgs,
    settings: defaultSettings,
    syncMeta,
    workspaces: [],
    trashItems: [],
  },
};

export const Closed: Story = {
  args: {
    ...sharedArgs,
    isOpen: false,
    settings: defaultSettings,
    syncMeta,
    workspaces: mockWorkspaces,
    trashItems: [],
  },
};
