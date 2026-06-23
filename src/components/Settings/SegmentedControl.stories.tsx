import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl, type SegmentedControlProps } from './SegmentedControl';

// Wrapper component (not an inline render fn) so the useState hook is valid.
function StatefulSegmentedControl(args: SegmentedControlProps<string>): React.JSX.Element {
  const [value, setValue] = useState(args.value);
  return <SegmentedControl {...args} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Components/Settings/SegmentedControl',
  component: SegmentedControl,
  parameters: { layout: 'centered' },
  args: {
    groupLabel: 'Theme',
    value: 'light',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'System' },
    ],
    onChange: () => {},
  },
  render: (args) => <StatefulSegmentedControl {...args} />,
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoOptions: Story = {
  args: {
    groupLabel: 'Default view',
    value: 'grid',
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'list', label: 'List' },
    ],
  },
};
