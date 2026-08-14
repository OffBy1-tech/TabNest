import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LocalSettings, SyncMeta } from '../../lib/schema';
import { SyncAndDataTab } from './SyncAndDataTab';

const localSettings: LocalSettings = { sync_enabled: true, sync_interval_minutes: 15 };

const baseSyncMeta: SyncMeta = {
  drive_file_id: null,
  last_sync_at: 0,
  last_modified_at: 0,
  device_id: 'device-1',
  sync_state: 'idle',
  pending_sync: false,
  error_message: null,
  retry_count: 0,
};

const meta = {
  title: 'Components/Settings/SyncAndDataTab',
  component: SyncAndDataTab,
  parameters: { layout: 'padded' },
  args: {
    localSettings,
    syncMeta: baseSyncMeta,
    workspaces: [],
    onLocalSettingsChange: (patch) => console.log('local settings', patch),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SyncAndDataTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {};

export const Connected: Story = {
  args: {
    syncMeta: { ...baseSyncMeta, drive_file_id: 'file-123', last_sync_at: Date.now() - 600_000 },
  },
};
