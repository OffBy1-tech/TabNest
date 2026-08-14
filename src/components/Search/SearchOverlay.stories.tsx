import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Workspace } from '../../lib/schema';
import { SearchOverlay } from './SearchOverlay';

const meta = {
  title: 'Components/SearchOverlay',
  component: SearchOverlay,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SearchOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Mock workspace data
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
        notes: [],
        order: 0,
        groups: [
          {
            id: 'grp-1',
            name: 'Research',
            created_at: NOW,
            updated_at: NOW,
            order: 0,
            notes: [],
            tabs: [
              {
                id: 'tab-1',
                title: 'React Documentation',
                url: 'https://react.dev/learn',
                favicon: 'https://react.dev/favicon.ico',
                saved_at: NOW,
              },
              {
                id: 'tab-2',
                title: 'TypeScript Handbook — Advanced Types',
                url: 'https://www.typescriptlang.org/docs/handbook/2/types-from-types.html',
                favicon: 'https://www.typescriptlang.org/favicon-32x32.png',
                saved_at: NOW,
              },
            ],
          },
          {
            id: 'grp-2',
            name: 'Design references',
            created_at: NOW,
            updated_at: NOW,
            order: 1,
            notes: [],
            tabs: [
              {
                id: 'tab-3',
                title: 'Figma — Design system playground',
                url: 'https://figma.com/file/abc123',
                saved_at: NOW,
              },
              {
                id: 'tab-4',
                title: 'Tailwind CSS — Color palette',
                url: 'https://tailwindcss.com/docs/customizing-colors',
                favicon: 'https://tailwindcss.com/favicons/favicon-32x32.png',
                saved_at: NOW,
              },
            ],
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Personal',
        color: '#16a34a',
        emoji: '🏠',
        collapsed: false,
        notes: [],
        order: 1,
        groups: [
          {
            id: 'grp-3',
            name: 'Reading',
            created_at: NOW,
            updated_at: NOW,
            order: 0,
            notes: [],
            tabs: [
              {
                id: 'tab-5',
                title: 'Hacker News',
                url: 'https://news.ycombinator.com',
                saved_at: NOW,
              },
              {
                id: 'tab-6',
                title: 'Wikipedia — Information theory',
                url: 'https://en.wikipedia.org/wiki/Information_theory',
                favicon: 'https://en.wikipedia.org/favicon.ico',
                saved_at: NOW,
              },
            ],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('close'),
    workspaces: mockWorkspaces,
  },
};

export const EmptyWorkspaces: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('close'),
    workspaces: [],
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    workspaces: mockWorkspaces,
  },
};
