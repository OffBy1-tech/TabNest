import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyncDot } from './SyncDot';

const meta = {
  title: 'Popup/SyncDot',
  component: SyncDot,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SyncDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { state: 'idle' } };
export const Syncing: Story = { args: { state: 'syncing' } };
export const Error: Story = { args: { state: 'error' } };
