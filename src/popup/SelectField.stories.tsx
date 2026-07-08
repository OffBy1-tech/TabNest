import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from './SelectField';

const meta = {
  title: 'Popup/SelectField',
  component: SelectField,
  parameters: { layout: 'padded' },
  args: {
    id: 'workspace',
    label: 'Workspace',
    value: 'personal',
    onChange: (v: string) => console.log('change', v),
    children: [
      <option key="personal" value="personal">Personal</option>,
      <option key="work" value="work">Work</option>,
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
