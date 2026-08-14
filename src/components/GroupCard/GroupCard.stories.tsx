import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TabGroup } from '../../lib/schema';
import { GroupCard } from './GroupCard';

const meta = {
  title: 'Components/GroupCard',
  component: GroupCard,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    viewMode: {
      control: 'radio',
      options: ['grid', 'list'],
    },
  },
} satisfies Meta<typeof GroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const NOW = Date.now();

const mockGroup: TabGroup = {
  id: 'group-1',
  name: 'Research',
  created_at: NOW - 86400000,
  updated_at: NOW,
  order: 0,
  notes: [],
  tabs: [
    {
      id: 'tab-1',
      title: 'React Documentation',
      url: 'https://react.dev',
      favicon: 'https://react.dev/favicon.ico',
      saved_at: NOW - 3600000,
    },
    {
      id: 'tab-2',
      title: 'TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs/handbook/',
      favicon: 'https://www.typescriptlang.org/favicon-32x32.png',
      saved_at: NOW - 7200000,
    },
    {
      id: 'tab-3',
      title: 'Vite — Next Generation Frontend Tooling',
      url: 'https://vitejs.dev',
      favicon: 'https://vitejs.dev/logo.svg',
      saved_at: NOW - 10800000,
    },
  ],
};

const manyTabsGroup: TabGroup = {
  id: 'group-2',
  name: 'Reading List',
  created_at: NOW - 172800000,
  updated_at: NOW,
  order: 1,
  notes: [],
  tabs: [
    { id: 't1', title: 'The New York Times', url: 'https://nytimes.com', favicon: 'https://nytimes.com/favicon.ico', saved_at: NOW },
    { id: 't2', title: 'Hacker News', url: 'https://news.ycombinator.com', favicon: '', saved_at: NOW },
    { id: 't3', title: 'GitHub — Explore', url: 'https://github.com/explore', favicon: 'https://github.com/favicon.ico', saved_at: NOW },
    { id: 't4', title: 'Stack Overflow — Questions', url: 'https://stackoverflow.com/questions', favicon: 'https://stackoverflow.com/favicon.ico', saved_at: NOW },
    { id: 't5', title: 'MDN Web Docs — JavaScript', url: 'https://developer.mozilla.org', favicon: 'https://developer.mozilla.org/favicon.ico', saved_at: NOW },
    { id: 't6', title: 'CSS-Tricks — A Complete Guide to Flexbox', url: 'https://css-tricks.com', favicon: '', saved_at: NOW },
    { id: 't7', title: 'Smashing Magazine — Design Patterns', url: 'https://smashingmagazine.com', favicon: '', saved_at: NOW },
    { id: 't8', title: 'Dev.to — Latest Articles', url: 'https://dev.to', favicon: '', saved_at: NOW },
  ],
};

const singleTabGroup: TabGroup = {
  id: 'group-3',
  name: 'Quick Save',
  created_at: NOW,
  updated_at: NOW,
  order: 2,
  notes: [],
  tabs: [
    {
      id: 'tab-solo',
      title: 'Wikipedia — Claude Shannon',
      url: 'https://en.wikipedia.org/wiki/Claude_Shannon',
      favicon: 'https://en.wikipedia.org/favicon.ico',
      saved_at: NOW,
    },
  ],
};

const longNameGroup: TabGroup = {
  id: 'group-4',
  name: 'A Very Long Group Name That Should Truncate Elegantly In Grid View',
  created_at: NOW,
  updated_at: NOW,
  order: 3,
  notes: [],
  tabs: [
    { id: 'tab-ln', title: 'Example', url: 'https://example.com', saved_at: NOW },
  ],
};

const emptyGroup: TabGroup = {
  id: 'group-5',
  name: 'Empty Group',
  created_at: NOW,
  updated_at: NOW,
  order: 4,
  notes: [],
  tabs: [],
};

const sharedArgs = {
  onRename: (id: string, name: string) => console.log('rename', id, name),
  onDelete: (id: string) => console.log('delete', id),
  onOpenAll: () => console.log('open all'),
  onOpenTab: (url: string) => console.log('open tab', url),
  onRemoveTab: (groupId: string, tabId: string) => console.log('remove tab', groupId, tabId),
  onMoveTab: (fromGroupId: string, toGroupId: string, tabId: string) =>
    console.log('move tab', tabId, 'from', fromGroupId, 'to', toGroupId),
  onSaveGroupNote: (groupId: string, content: string) =>
    console.log('save group note', groupId, content),
  onSaveTabNote: (groupId: string, tabId: string, note: string) =>
    console.log('save tab note', groupId, tabId, note),
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const GridView: Story = {
  args: {
    group: mockGroup,
    viewMode: 'grid',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const ListView: Story = {
  args: {
    group: mockGroup,
    viewMode: 'list',
    ...sharedArgs,
  },
};

export const ManyTabsCollapsed: Story = {
  name: 'Many Tabs — Collapsed',
  args: {
    group: manyTabsGroup,
    viewMode: 'grid',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const SingleTab: Story = {
  args: {
    group: singleTabGroup,
    viewMode: 'grid',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const LongGroupName: Story = {
  args: {
    group: longNameGroup,
    viewMode: 'grid',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const EmptyGroup: Story = {
  args: {
    group: emptyGroup,
    viewMode: 'grid',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
