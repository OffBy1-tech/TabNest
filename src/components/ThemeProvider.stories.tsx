import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeProvider';

const meta = {
  title: 'Components/ThemeProvider',
  component: ThemeProvider,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ThemeProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Demo consumer that shows current theme values
// ---------------------------------------------------------------------------

function ThemeDisplay(): React.JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 8,
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
        fontFamily: 'var(--font-sans)',
        minWidth: 280,
      }}
    >
      <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 14 }}>
        <strong>Preference:</strong> {theme}
      </p>
      <p style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 14 }}>
        <strong>Resolved:</strong> {resolvedTheme}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              backgroundColor: theme === t ? 'var(--color-brand-500)' : 'var(--bg-base)',
              color: theme === t ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export const Light: Story = {
  args: {
    defaultTheme: 'light',
    children: <ThemeDisplay />,
  },
};

export const Dark: Story = {
  args: {
    defaultTheme: 'dark',
    children: <ThemeDisplay />,
  },
};

export const System: Story = {
  args: {
    defaultTheme: 'system',
    children: <ThemeDisplay />,
  },
};
