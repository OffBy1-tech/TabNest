import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoteEditor } from './NoteEditor';

const meta = {
  title: 'Components/GroupCard/NoteEditor',
  component: NoteEditor,
  parameters: { layout: 'padded' },
  args: {
    initialValue: '',
    placeholder: 'Add a note…',
    onSave: (value: string) => console.log('save', value),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithContent: Story = {
  args: { initialValue: 'Remember to revisit the pricing section.' },
};
