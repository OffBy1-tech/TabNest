import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Normal rendering — no error
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    children: (
      <div style={{ padding: 24 }}>
        <p>Content renders normally when there is no error.</p>
      </div>
    ),
  },
};

// ---------------------------------------------------------------------------
// Error state — trigger by rendering a throwing child
// ---------------------------------------------------------------------------

function ThrowingChild(): React.JSX.Element {
  throw new Error('Simulated render crash for Storybook');
}

export const ErrorState: Story = {
  args: {
    children: <ThrowingChild />,
  },
};

// ---------------------------------------------------------------------------
// Custom fallback
// ---------------------------------------------------------------------------

export const CustomFallback: Story = {
  args: {
    fallback: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
          background: '#fef2f2',
          borderRadius: 8,
          color: '#dc2626',
          fontFamily: 'system-ui',
          fontSize: 14,
        }}
      >
        Custom error UI — something went wrong.
      </div>
    ),
    children: <ThrowingChild />,
  },
};
