import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextMenu } from './ContextMenu';

const meta = {
  title: 'Components/Sidebar/ContextMenu',
  component: ContextMenu,
  parameters: { layout: 'centered' },
  args: {
    x: 40,
    y: 40,
    onRename: () => console.log('rename'),
    onDelete: () => console.log('delete'),
    onClose: () => console.log('close'),
  },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
