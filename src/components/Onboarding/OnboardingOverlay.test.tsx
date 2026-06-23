import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingOverlay } from './OnboardingOverlay'

function renderOverlay(props: Partial<Parameters<typeof OnboardingOverlay>[0]> = {}) {
  const handlers = {
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    onOpenActiveTabs: vi.fn(),
    onConnectDrive: vi.fn(),
  }
  render(<OnboardingOverlay isOpen {...handlers} {...props} />)
  return handlers
}

describe('OnboardingOverlay', () => {
  it('renders nothing when closed', () => {
    const { onSkip } = renderOverlay({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('opens on step 1 in an accessible dialog', () => {
    renderOverlay()
    expect(screen.getByRole('dialog', { name: 'Welcome to Tab Nest' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Save your first tab' })).toBeInTheDocument()
    expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument()
  })

  it('advances through the steps via the primary buttons', () => {
    const { onOpenActiveTabs } = renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: 'Open Active Tabs panel' }))
    expect(onOpenActiveTabs).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Meet your workspace' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Got it, go to next step' }))
    expect(screen.getByRole('heading', { name: /Keep your tabs safe/ })).toBeInTheDocument()
  })

  it('connects drive and completes on the final step', () => {
    const handlers = renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: 'Open Active Tabs panel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Got it, go to next step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }))
    expect(handlers.onConnectDrive).toHaveBeenCalledOnce()
    expect(handlers.onComplete).toHaveBeenCalledOnce()
  })

  it('skips from the Skip button and on Escape', () => {
    const { onSkip } = renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: 'Skip onboarding' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSkip).toHaveBeenCalledTimes(2)
  })
})
