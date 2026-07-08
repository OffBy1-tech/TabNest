import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HelpTab } from './HelpTab'

describe('HelpTab', () => {
  it('calls onShowOnboarding when the button is clicked', () => {
    const onShowOnboarding = vi.fn()
    render(<HelpTab onShowOnboarding={onShowOnboarding} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show onboarding walkthrough again' }))
    expect(onShowOnboarding).toHaveBeenCalledOnce()
  })

  it('links to the GitHub repository, opening in a new tab safely', () => {
    render(<HelpTab />)
    const link = screen.getByRole('link', { name: /GitHub repository/i })
    expect(link).toHaveAttribute('href', 'https://github.com/OffBy1-tech/TabNest')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('does not crash when onShowOnboarding is omitted', () => {
    render(<HelpTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Show onboarding walkthrough again' }))
    // No throw ⇒ pass
    expect(screen.getByRole('button', { name: 'Show onboarding walkthrough again' })).toBeInTheDocument()
  })
})
