import type { Meta, StoryObj } from '@storybook/react-vite';
import { RenameInput } from './RenameInput';

const meta = {
  title: 'Components/Sidebar/RenameInput',
  component: RenameInput,
  parameters: { layout: 'padded' },
  args: {
    initialValue: 'Reading',
    onConfirm: (value: string) => console.log('confirm', value),
    onCancel: () => console.log('cancel'),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 240, display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RenameInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { initialValue: '' } };
