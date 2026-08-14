import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[tabNest] Uncaught render error:', error, info.componentStack)
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px',
            fontFamily: 'system-ui, sans-serif',
            color: '#374151',
            backgroundColor: '#f9fafb',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2rem' }} aria-hidden="true">⚠️</span>
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', maxWidth: 360 }}>
            Tab Nest ran into an unexpected error. Please reload this page to recover.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#1A56DB',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {this.state.error && (
            <details style={{ fontSize: '0.75rem', color: '#9ca3af', maxWidth: 480, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
