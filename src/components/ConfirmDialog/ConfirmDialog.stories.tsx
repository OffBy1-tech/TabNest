import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    isOpen: false,
    title: 'Confirm',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Wrapper with open-state button
// ---------------------------------------------------------------------------

function ConfirmDemo({
  title,
  message,
  confirmLabel,
  destructive,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: 'none',
          backgroundColor: destructive ? '#dc2626' : 'var(--color-brand-500)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Open dialog
      </button>
      <ConfirmDialog
        isOpen={open}
        title={title}
        message={message}
        {...(confirmLabel ? { confirmLabel } : {})}
        {...(destructive ? { destructive } : {})}
        onConfirm={() => {
          alert('Confirmed!');
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <ConfirmDemo
      title="Save changes?"
      message="Are you sure you want to save these changes to the group?"
    />
  ),
};

export const Destructive: Story = {
  render: () => (
    <ConfirmDemo
      title="Delete group"
      message='Delete "Research tabs"? This will move the group to trash and cannot be undone without restoring from trash.'
      confirmLabel="Delete"
      destructive
    />
  ),
};

export const LongMessage: Story = {
  render: () => (
    <ConfirmDemo
      title="Empty trash"
      message="You are about to permanently delete all 47 items from the trash. This action cannot be undone — the tabs and groups will be gone forever. Are you absolutely sure you want to continue?"
      confirmLabel="Empty Trash"
      destructive
    />
  ),
};

export const Closed: Story = {
  render: () => (
    <ConfirmDialog
      isOpen={false}
      title="Not visible"
      message="This dialog should not appear."
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  ),
};
