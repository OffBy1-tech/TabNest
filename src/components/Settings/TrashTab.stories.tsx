import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TrashItem } from '../../lib/schema';
import { TrashTab } from './TrashTab';

const items: TrashItem[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'group',
    data: { name: 'Research' },
    original_location: { workspace_id: '22222222-2222-2222-2222-222222222222' },
    deleted_at: Date.now() - 3600_000,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    type: 'category',
    data: { name: 'Reading List' },
    original_location: { workspace_id: '22222222-2222-2222-2222-222222222222' },
    deleted_at: Date.now() - 86_400_000,
  },
];

const meta = {
  title: 'Components/Settings/TrashTab',
  component: TrashTab,
  parameters: { layout: 'padded' },
  args: {
    trashItems: items,
    onRestore: (id) => console.log('restore', id),
    onDeletePermanently: (id) => console.log('delete', id),
    onEmptyTrash: () => console.log('empty trash'),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrashTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {};

export const Empty: Story = {
  args: { trashItems: [] },
};
