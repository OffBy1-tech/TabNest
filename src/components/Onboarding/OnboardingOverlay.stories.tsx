import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingOverlay } from './OnboardingOverlay';

const meta = {
  title: 'Components/OnboardingOverlay',
  component: OnboardingOverlay,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OnboardingOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  isOpen: true,
  onComplete: () => console.log('onboarding complete'),
  onSkip: () => console.log('onboarding skipped'),
  onOpenActiveTabs: () => console.log('open active tabs'),
  onConnectDrive: () => console.log('connect drive'),
};

// Opens on step 1; advancing through steps is driven by the in-component
// buttons ("Open Active Tabs", "Got it"), not props.
export const Open: Story = {
  args: { ...baseArgs },
};

export const Closed: Story = {
  args: { ...baseArgs, isOpen: false },
};
