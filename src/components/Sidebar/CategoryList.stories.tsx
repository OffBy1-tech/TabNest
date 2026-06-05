import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Category } from '../../lib/schema';
import { CategoryList } from './CategoryList';

const meta = {
  title: 'Components/Sidebar/CategoryList',
  component: CategoryList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CategoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const NOW = Date.now();

function makeGroup(id: string, name: string) {
  return {
    id,
    name,
    created_at: NOW,
    updated_at: NOW,
    order: 0,
    tabs: [],
    notes: [],
  };
}

const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Work',
    color: '#1A56DB',
    emoji: '💼',
    collapsed: false,
    order: 0,
    groups: [makeGroup('g1', 'Research'), makeGroup('g2', 'Meetings'), makeGroup('g3', 'Docs')],
  },
  {
    id: 'cat-2',
    name: 'Personal',
    color: '#16a34a',
    emoji: '🏠',
    collapsed: false,
    order: 1,
    groups: [makeGroup('g4', 'Shopping'), makeGroup('g5', 'Travel')],
  },
  {
    id: 'cat-3',
    name: 'Learning',
    color: '#7c3aed',
    emoji: '📚',
    collapsed: false,
    order: 2,
    groups: [makeGroup('g6', 'Courses'), makeGroup('g7', 'Articles'), makeGroup('g8', 'Videos'), makeGroup('g9', 'Books')],
  },
];

const sharedArgs = {
  onSelectCategory: (id: string | null) => console.log('select', id),
  onCreateCategory: () => console.log('create category'),
  onRenameCategory: (id: string, name: string) => console.log('rename', id, name),
  onDeleteCategory: (id: string) => console.log('delete', id),
  onReorderCategories: (ids: string[]) => console.log('reorder', ids),
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    categories: mockCategories,
    selectedCategoryId: null,
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, backgroundColor: 'var(--bg-surface)', padding: 8, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export const FirstCategorySelected: Story = {
  args: {
    categories: mockCategories,
    selectedCategoryId: 'cat-1',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, backgroundColor: 'var(--bg-surface)', padding: 8, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export const EmptyList: Story = {
  args: {
    categories: [],
    selectedCategoryId: null,
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, backgroundColor: 'var(--bg-surface)', padding: 8, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export const SingleCategory: Story = {
  args: {
    categories: [mockCategories[0]!],
    selectedCategoryId: 'cat-1',
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, backgroundColor: 'var(--bg-surface)', padding: 8, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export const LongCategoryName: Story = {
  args: {
    categories: [
      {
        ...mockCategories[0]!,
        name: 'A Very Long Category Name That Overflows The Sidebar Width',
      },
    ],
    selectedCategoryId: null,
    ...sharedArgs,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220, backgroundColor: 'var(--bg-surface)', padding: 8, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};
