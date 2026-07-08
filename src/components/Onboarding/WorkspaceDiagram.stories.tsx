import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkspaceDiagram } from './WorkspaceDiagram';

const meta = {
  title: 'Components/Onboarding/WorkspaceDiagram',
  component: WorkspaceDiagram,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof WorkspaceDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
