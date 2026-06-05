import React, { useState } from 'react'

interface FaviconImageProps {
  url: string
  title: string
  size?: number
}

export function FaviconImage({
  url,
  title,
  size = 16,
}: FaviconImageProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  const firstLetter = title.trim().charAt(0).toUpperCase() || '?'

  if (!url || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(size * 0.6, 8),
          fontWeight: 600,
          lineHeight: 1,
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        {firstLetter}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={`${title} favicon`}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        minWidth: size,
        objectFit: 'contain',
        borderRadius: 'var(--radius-sm)',
      }}
      onError={() => setFailed(true)}
    />
  )
}
