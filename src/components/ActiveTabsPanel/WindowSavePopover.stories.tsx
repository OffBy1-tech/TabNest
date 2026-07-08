import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindowSavePopover } from './WindowSavePopover';
import { makeWorkspaces } from './testFixtures';

const meta = {
  title: 'Components/ActiveTabsPanel/WindowSavePopover',
  component: WindowSavePopover,
  parameters: { layout: 'padded' },
  args: {
    tabCount: 8,
    workspaces: makeWorkspaces(),
    onSave: (...a) => console.log('save', ...a),
    onClose: () => console.log('close'),
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 280, height: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WindowSavePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
