import React from 'react'
import { rowStyle, lastRowStyle, rowLabelStyle } from './styles'

export interface SettingRowProps {
  label: string
  htmlFor?: string
  /** Drop the bottom divider — use on the final row of a section. */
  last?: boolean
  children: React.ReactNode
}

/** A labelled settings row: label on the left, control (children) on the right. */
export function SettingRow({
  label,
  htmlFor,
  last,
  children,
}: SettingRowProps): React.JSX.Element {
  return (
    <div style={last ? lastRowStyle : rowStyle}>
      <label htmlFor={htmlFor} style={rowLabelStyle}>
        {label}
      </label>
      {children}
    </div>
  )
}
