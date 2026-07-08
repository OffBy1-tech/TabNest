import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingRow } from './SettingRow'

describe('SettingRow', () => {
  it('renders the label and children', () => {
    render(
      <SettingRow label="Theme">
        <button>control</button>
      </SettingRow>,
    )
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'control' })).toBeInTheDocument()
  })

  it('associates the label with a control via htmlFor', () => {
    render(
      <SettingRow label="Name" htmlFor="name-input">
        <input id="name-input" />
      </SettingRow>,
    )
    // getByLabelText resolves the <label for> ⇒ control association.
    expect(screen.getByLabelText('Name')).toBe(document.getElementById('name-input'))
  })
})
