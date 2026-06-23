import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TabGroup } from '@/lib/schema';
import { GroupGrid } from './GroupGrid';

const NOW = Date.now();

const groups: TabGroup[] = [
  {
    id: 'g1', name: 'Research', created_at: NOW, updated_at: NOW, order: 0, notes: [],
    tabs: [
      { id: 't1', title: 'React', url: 'https://react.dev', favicon: '', saved_at: NOW },
      { id: 't2', title: 'Vite', url: 'https://vitejs.dev', favicon: '', saved_at: NOW },
    ],
  },
  {
    id: 'g2', name: 'Reading', created_at: NOW, updated_at: NOW, order: 1, notes: [],
    tabs: [{ id: 't3', title: 'Hacker News', url: 'https://news.ycombinator.com', favicon: '', saved_at: NOW }],
  },
];

const noop = () => {};

const meta = {
  title: 'Newtab/GroupGrid',
  component: GroupGrid,
  parameters: { layout: 'fullscreen' },
  args: {
    groups,
    viewMode: 'grid',
    showFavicons: true,
    onRenameGroup: noop,
    onDeleteGroup: noop,
    onOpenAll: noop,
    onRemoveTab: noop,
    onMoveTab: noop,
    onOpenTab: noop,
    onSaveGroupNote: noop,
    onSaveTabNote: noop,
  },
} satisfies Meta<typeof GroupGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {};
export const ListView: Story = { args: { viewMode: 'list' } };
export const Empty: Story = { args: { groups: [], onCreateGroup: noop } };
