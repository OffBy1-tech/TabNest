import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyncStatusDot } from './SyncStatusDot';

const meta = {
  title: 'Components/TopBar/SyncStatusDot',
  component: SyncStatusDot,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SyncStatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Synced: Story = { args: { syncState: 'idle', lastSyncAt: Date.now() - 60_000 } };
export const Syncing: Story = { args: { syncState: 'syncing', lastSyncAt: 0 } };
export const Error: Story = { args: { syncState: 'error', lastSyncAt: 0 } };
export const NeverSynced: Story = { args: { syncState: 'idle', lastSyncAt: 0 } };
