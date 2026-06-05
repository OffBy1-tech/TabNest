import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PopupApp } from './PopupApp';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error(
    '[tabNest] Could not find #root element. Check popup.html.',
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <PopupApp />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
