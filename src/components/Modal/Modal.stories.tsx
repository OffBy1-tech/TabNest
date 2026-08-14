import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { Modal } from './Modal';

const meta = {
  title: 'Components/Modal',
  component: Modal,
  args: {
    isOpen: false,
    onClose: () => {},
    title: 'Modal',
    children: null,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Wrapper that manages open state
// ---------------------------------------------------------------------------

function ModalDemo({
  title,
  size,
  children,
}: {
  title: string;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
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
          backgroundColor: 'var(--color-brand-500)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Open modal
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        {...(size ? { size } : {})}
      >
        {children ?? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            This is the modal body content. It can contain any React elements.
          </p>
        )}
      </Modal>
    </div>
  );
}

export const Small: Story = {
  render: () => <ModalDemo title="Small modal" size="sm" />,
};

export const Medium: Story = {
  render: () => <ModalDemo title="Medium modal" size="md" />,
};

export const Large: Story = {
  render: () => (
    <ModalDemo title="Large modal with long content" size="lg">
      <div>
        {Array.from({ length: 12 }).map((_, i) => (
          <p
            key={i}
            style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}
          >
            Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
            do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        ))}
      </div>
    </ModalDemo>
  ),
};

export const Closed: Story = {
  render: () => {
    return (
      <Modal isOpen={false} onClose={() => {}} title="Closed modal">
        <p>This should not be visible.</p>
      </Modal>
    );
  },
};
