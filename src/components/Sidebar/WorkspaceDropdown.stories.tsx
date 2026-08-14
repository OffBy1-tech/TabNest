import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Workspace } from '../../lib/schema';
import { WorkspaceDropdown } from './WorkspaceDropdown';

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Personal', created_at: 0, categories: [] },
  { id: 'ws-2', name: 'Work', created_at: 0, categories: [] },
  { id: 'ws-3', name: 'Side Projects', created_at: 0, categories: [] },
];

const meta = {
  title: 'Components/Sidebar/WorkspaceDropdown',
  component: WorkspaceDropdown,
  parameters: { layout: 'padded' },
  args: {
    workspaces,
    activeWorkspaceId: 'ws-1',
    onSelectWorkspace: (id) => console.log('select', id),
    onCreateWorkspace: (name) => console.log('create', name),
    onRenameWorkspace: (id, name) => console.log('rename', id, name),
  },
  // The menu is absolutely positioned; give it a relative host with height.
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkspaceDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
