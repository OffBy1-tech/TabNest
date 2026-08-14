import type { Meta, StoryObj } from '@storybook/react-vite';
import { diffWorkspaces } from '../../lib/diff';
import { tab, group, category, workspace } from '../../lib/testFixtures';
import { DiffTree } from './DiffTree';

const before = [
  workspace('w1', [
    category('research', {
      name: 'Research',
      groups: [
        group('scratch', { name: 'scratch', tabs: [tab('Ollama docs'), tab('LevelDB format'), tab('MV3 alarms')] }),
        group('reading', { name: 'To read', tabs: [tab('Old article')] }),
      ],
    }),
    category('start', { name: 'Getting Started', groups: [group('welcome', { name: 'Welcome', tabs: [tab('Docs')] })] }),
  ], { name: 'My Workspace' }),
];

const after = [
  workspace('w1', [
    category('research', {
      name: 'Research',
      groups: [
        group('reading', { name: 'Reading list', tabs: [tab('Old article'), tab('HN: MV3 pitfalls')] }),
        group('papers', { name: 'LLM papers', tabs: [tab('Attention'), tab('RLHF survey')] }),
      ],
    }),
    category('start', { name: 'Getting Started', groups: [group('welcome', { name: 'Welcome', tabs: [tab('Docs')] })] }),
  ], { name: 'My Workspace' }),
];

const meta = {
  title: 'Components/Settings/DiffTree',
  component: DiffTree,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof DiffTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedChanges: Story = {
  args: { diff: diffWorkspaces(before, after) },
};

export const NoDifferences: Story = {
  args: { diff: diffWorkspaces(after, after) },
};

export const LongTabListTruncated: Story = {
  args: {
    diff: diffWorkspaces(
      [workspace('w1', [category('c', { name: 'Research', groups: [group('big', { name: 'big window', tabs: Array.from({ length: 23 }, (_, i) => tab(`Tab ${i + 1}`)) })] })])],
      [workspace('w1', [category('c', { name: 'Research' })])],
    ),
  },
};
