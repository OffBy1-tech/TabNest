import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShortcutsTab } from './ShortcutsTab';

const meta = {
  title: 'Components/Settings/ShortcutsTab',
  component: ShortcutsTab,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShortcutsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
