import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BackupGeneration } from '../../lib/schema';
import { tab, group, category, workspace } from '../../lib/testFixtures';
import { BackupsSection } from './BackupsSection';
const current = [workspace('w', [
  category('c', {
    name: 'Research',
    groups: [
      group('g1', { name: 'Reading list', tabs: [tab('Article')] }),
      group('g3', { name: 'LLM papers', tabs: [tab('Attention')] }),
    ],
  }),
], { name: 'My Workspace' })];
const backups: BackupGeneration[] = [
  {
    saved_at: Date.now() - 3600_000,
    workspaces: [workspace('w', [
      category('c', {
        name: 'Research',
        groups: [
          group('g1', { name: 'Reading list', tabs: [tab('Article')] }),
          group('g2', { name: 'scratch', tabs: [tab('Ollama docs'), tab('LevelDB format')] }),
        ],
      }),
    ], { name: 'My Workspace' })],
  },
  { saved_at: 0, workspaces: current },
];
const meta = {
  title: 'Components/Settings/BackupsSection',
  component: BackupsSection,
  parameters: { layout: 'padded' },
  args: {
    backups,
    currentWorkspaces: current,
    onRestore: (i) => console.log('restore', i),
    restoreNotice: null,
    restoreError: null,
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof BackupsSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithBackups: Story = {};
export const Empty: Story = { args: { backups: [] } };
export const AfterRestore: Story = {
  args: { restoreNotice: 'Backup restored. Your previous workspaces were saved as a new backup.' },
};
