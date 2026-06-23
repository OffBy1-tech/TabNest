import type { Meta, StoryObj } from '@storybook/react-vite';
import { SavePopover } from './SavePopover';
import { makeTab, makeWorkspaces } from './testFixtures';

const meta = {
  title: 'Components/ActiveTabsPanel/SavePopover',
  component: SavePopover,
  parameters: { layout: 'padded' },
  args: {
    tab: makeTab({ id: 7, title: 'React Docs', url: 'https://react.dev' }),
    workspaces: makeWorkspaces(),
    onSave: (...a) => console.log('save', ...a),
    onClose: () => console.log('close'),
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 280, height: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SavePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
