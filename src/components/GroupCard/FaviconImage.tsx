import React, { useState } from 'react'
import { resolveFaviconUrl } from '../../lib/safeUrl'

interface FaviconImageProps {
  /** The stored favicon URL (semi-untrusted: Drive sync / JSON import). */
  url: string
  title: string
  /**
   * The saved tab's page URL. When provided (and running as an extension), the
   * favicon is served from Chrome's local `_favicon` cache instead of the stored
   * URL — no network request to the site, so a crafted favicon can't beacon.
   */
  pageUrl?: string | undefined
  size?: number
}

export function FaviconImage({
  url,
  title,
  pageUrl,
  size = 16,
}: FaviconImageProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  const firstLetter = title.trim().charAt(0).toUpperCase() || '?'

  // Prefer Chrome's local favicon service; fall back to the scheme-filtered
  // stored favicon; else the letter avatar. See resolveFaviconUrl in safeUrl.ts.
  const src = resolveFaviconUrl(pageUrl, url, size)

  if (!src || failed) {
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
      src={src}
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
