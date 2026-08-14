import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast';

const meta = {
  title: 'Components/Toast/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    toast: {
      id: 'toast-success',
      message: 'Group saved successfully.',
      type: 'success',
      duration: 99999,
    },
    onDismiss: () => {},
  },
};

export const Error: Story = {
  args: {
    toast: {
      id: 'toast-error',
      message: 'Failed to sync with Google Drive. Please try again.',
      type: 'error',
      duration: 99999,
    },
    onDismiss: () => {},
  },
};

export const Info: Story = {
  args: {
    toast: {
      id: 'toast-info',
      message: 'Opening all 12 tabs in a new window.',
      type: 'info',
      duration: 99999,
    },
    onDismiss: () => {},
  },
};

export const LongMessage: Story = {
  args: {
    toast: {
      id: 'toast-long',
      message:
        'Your workspace data has been backed up to Google Drive successfully. All 247 saved tabs are now safe.',
      type: 'success',
      duration: 99999,
    },
    onDismiss: () => {},
  },
};
