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

// ---------------------------------------------------------------------------
// Step 1: Save your first tab
// ---------------------------------------------------------------------------

export const Step1SaveFirstTab: Story = {
  args: {
    ...baseArgs,
    tabSaved: false,
  },
};

// ---------------------------------------------------------------------------
// Step 2: Meet your workspace (triggered when tabSaved transitions to true)
// We cannot easily advance the step without interaction, so we show step 1
// with tabSaved=true — which immediately triggers step 2 in the component.
// ---------------------------------------------------------------------------

export const Step2MeetWorkspace: Story = {
  args: {
    ...baseArgs,
    tabSaved: true,
  },
};

// ---------------------------------------------------------------------------
// Closed state
// ---------------------------------------------------------------------------

export const Closed: Story = {
  args: {
    ...baseArgs,
    isOpen: false,
    tabSaved: false,
  },
};
