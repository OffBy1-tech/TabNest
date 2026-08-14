import type { Meta, StoryObj } from '@storybook/react-vite';
import { InlineNameEditor } from './InlineNameEditor';

const meta = {
  title: 'Components/GroupCard/InlineNameEditor',
  component: InlineNameEditor,
  parameters: { layout: 'padded' },
  args: {
    value: 'Research',
    onConfirm: (value: string) => console.log('confirm', value),
    onCancel: () => console.log('cancel'),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280, display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineNameEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { value: '' },
};
