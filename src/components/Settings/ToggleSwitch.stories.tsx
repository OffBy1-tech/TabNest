import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToggleSwitch, type ToggleSwitchProps } from './ToggleSwitch';

// Wrapper component (not an inline render fn) so the useState hook is valid.
function StatefulToggle(args: ToggleSwitchProps): React.JSX.Element {
  const [checked, setChecked] = useState(args.checked);
  return <ToggleSwitch {...args} checked={checked} onChange={setChecked} />;
}

const meta = {
  title: 'Components/Settings/ToggleSwitch',
  component: ToggleSwitch,
  parameters: { layout: 'centered' },
  args: { id: 'demo', label: 'Demo toggle', checked: false, onChange: () => {} },
  render: (args) => <StatefulToggle {...args} />,
} satisfies Meta<typeof ToggleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };
