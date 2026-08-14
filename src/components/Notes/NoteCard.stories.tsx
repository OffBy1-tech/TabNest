import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoteCard } from './NoteCard';

const meta = {
  title: 'Components/Notes/NoteCard',
  component: NoteCard,
  parameters: { layout: 'centered' },
  args: {
    onChange: (id: string, content: string) => console.log('change', id, content),
    onDelete: (id: string) => console.log('delete', id),
  },
} satisfies Meta<typeof NoteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {
  args: {
    viewMode: 'grid',
    note: {
      id: 'note-1',
      content: '# Shopping\n- [ ] milk\n- [x] eggs',
      created_at: Date.now() - 86400000,
      updated_at: Date.now(),
    },
  },
};

export const List: Story = {
  args: {
    ...Grid.args,
    viewMode: 'list',
  },
};
