import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { App } from './App';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error(
    '[tabNest] Could not find #root element. Check newtab.html.',
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
