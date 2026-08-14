import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_SETTINGS, type UserSettings, type Workspace } from '../../lib/schema';
import { NewTabPageTab } from './NewTabPageTab';

const settings: UserSettings = {
  ...DEFAULT_SETTINGS,
  theme: 'light',
  active_tabs_on_load: true,
  default_workspace_id: 'ws-1',
};

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Personal', created_at: 0, categories: [] },
  { id: 'ws-2', name: 'Work', created_at: 0, categories: [] },
];

const meta = {
  title: 'Components/Settings/NewTabPageTab',
  component: NewTabPageTab,
  parameters: { layout: 'padded' },
  args: { settings, workspaces, onChange: (patch) => console.log('change', patch) },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NewTabPageTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
