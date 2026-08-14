import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpTab } from './HelpTab';

const meta = {
  title: 'Components/Settings/HelpTab',
  component: HelpTab,
  parameters: { layout: 'padded' },
  args: { onShowOnboarding: () => console.log('show onboarding') },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HelpTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
