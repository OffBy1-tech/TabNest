import React from 'react'

/** Static illustration for onboarding step 2: Category › Group › Tabs hierarchy. */
export function WorkspaceDiagram(): React.JSX.Element {
  const boxStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }
  const nodeStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-surface)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }
  const arrowStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    color: 'var(--text-muted)',
    lineHeight: 1,
  }

  return (
    <div
      aria-label="Hierarchy diagram: Category contains Groups, Groups contain Tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4) var(--space-6)',
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        marginTop: 'var(--space-4)',
        marginBottom: 'var(--space-2)',
      }}
    >
      <div style={boxStyle}>
        <span style={labelStyle}>Category</span>
        <div style={{ ...nodeStyle, borderColor: 'var(--color-brand-500)' }}>Work</div>
      </div>

      <span aria-hidden="true" style={arrowStyle}>›</span>

      <div style={boxStyle}>
        <span style={labelStyle}>Group</span>
        <div style={nodeStyle}>Research</div>
      </div>

      <span aria-hidden="true" style={arrowStyle}>›</span>

      <div style={boxStyle}>
        <span style={labelStyle}>Tabs</span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
          }}
        >
          {['Tab A', 'Tab B'].map((t) => (
            <div
              key={t}
              style={{
                ...nodeStyle,
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
