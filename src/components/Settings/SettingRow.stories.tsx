import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingRow } from './SettingRow';
import { ToggleSwitch } from './ToggleSwitch';

const meta = {
  title: 'Components/Settings/SettingRow',
  component: SettingRow,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithToggle: Story = {
  args: {
    label: 'Show favicons',
    children: <ToggleSwitch id="demo" label="Show favicons" checked onChange={() => {}} />,
  },
};

export const LastRowNoDivider: Story = {
  args: {
    label: 'Compact mode',
    last: true,
    children: <ToggleSwitch id="demo2" label="Compact mode" checked={false} onChange={() => {}} />,
  },
};
