import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepDots } from './StepDots';

const meta = {
  title: 'Components/Onboarding/StepDots',
  component: StepDots,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StepDots>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepOne: Story = { args: { step: 1 } };
export const StepTwo: Story = { args: { step: 2 } };
export const StepThree: Story = { args: { step: 3 } };
