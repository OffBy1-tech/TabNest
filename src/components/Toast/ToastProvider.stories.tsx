import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { ToastProvider, useToast } from './ToastProvider';

const meta = {
  title: 'Components/Toast/ToastProvider',
  component: ToastProvider,
  args: {
    children: null,
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Demo trigger buttons that fire different toast types
// ---------------------------------------------------------------------------

function ToastTriggers(): React.JSX.Element {
  const { showToast } = useToast();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => showToast('Tab group saved successfully!', 'success')}
        style={btnStyle('#16a34a')}
      >
        Show success toast
      </button>
      <button
        onClick={() => showToast('Failed to save. Check your connection.', 'error')}
        style={btnStyle('#dc2626')}
      >
        Show error toast
      </button>
      <button
        onClick={() => showToast('Opening all 8 tabs now...', 'info')}
        style={btnStyle('#2563eb')}
      >
        Show info toast
      </button>
      <button
        onClick={() => {
          showToast('First notification', 'success');
          showToast('Second notification', 'info');
          showToast('Third notification — error', 'error');
        }}
        style={btnStyle('#7c3aed')}
      >
        Stack 3 toasts
      </button>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: bg,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  };
}

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <ToastTriggers />
    </ToastProvider>
  ),
};

export const WithInitialToast: Story = {
  render: () => {
    function AutoToast(): React.JSX.Element {
      const { showToast } = useToast();
      React.useEffect(() => {
        showToast('Welcome back to Tab Nest!', 'success', 99999);
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Toast auto-fired on mount.</p>;
    }
    return (
      <ToastProvider>
        <AutoToast />
      </ToastProvider>
    );
  },
};
