import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SavedTab } from '../../lib/schema';
import { TabRow } from './TabRow';

const tab: SavedTab = {
  id: 'tab-1',
  title: 'React Documentation',
  url: 'https://react.dev/learn',
  favicon: 'https://react.dev/favicon.ico',
  saved_at: Date.now(),
};

const meta = {
  title: 'Components/GroupCard/TabRow',
  component: TabRow,
  parameters: { layout: 'padded' },
  args: {
    tab,
    groupId: 'group-1',
    onOpenTab: (url: string) => console.log('open', url),
    onRemoveTab: (g: string, t: string) => console.log('remove', g, t),
    onSaveTabNote: (g: string, t: string, n: string) => console.log('note', g, t, n),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithNote: Story = {
  args: { tab: { ...tab, note: 'Re-read the hooks section.' } },
};

export const NoFavicon: Story = {
  args: { showFavicons: false },
};
