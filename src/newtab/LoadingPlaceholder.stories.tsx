import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingPlaceholder } from './LoadingPlaceholder';

const meta = {
  title: 'Newtab/LoadingPlaceholder',
  component: LoadingPlaceholder,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoadingPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
