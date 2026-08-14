import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindowSection } from './WindowSection';
import { makeTab, makeWorkspaces } from './testFixtures';

const meta = {
  title: 'Components/ActiveTabsPanel/WindowSection',
  component: WindowSection,
  parameters: { layout: 'padded' },
  args: {
    tabs: [
      makeTab({ id: 1, title: 'React Documentation', url: 'https://react.dev', active: true }),
      makeTab({ id: 2, title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org' }),
      makeTab({ id: 3, title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }),
    ],
    windowId: 1,
    windowIndex: 0,
    workspaces: makeWorkspaces(),
    onSaveTab: (...a) => console.log('save tab', ...a),
    onSaveWindowTabs: (...a) => console.log('save window', ...a),
    onCloseTab: (id) => console.log('close', id),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WindowSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
