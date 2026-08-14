import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  it('starts on light and advertises switching to dark', () => {
    renderToggle()
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('cycles light → dark → system → light on successive clicks', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(screen.getByRole('button', { name: 'Switch to system theme' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to system theme' }))
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})
