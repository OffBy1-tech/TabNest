import React, { useEffect, useState } from 'react'

export function Clock(): React.JSX.Element {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours = time.getHours().toString().padStart(2, '0')
  const minutes = time.getMinutes().toString().padStart(2, '0')

  return (
    <time
      dateTime={`${hours}:${minutes}`}
      aria-label={`Current time: ${hours}:${minutes}`}
      style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {hours}:{minutes}
    </time>
  )
}
