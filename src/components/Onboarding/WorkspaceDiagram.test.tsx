import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceDiagram } from './WorkspaceDiagram'

describe('WorkspaceDiagram', () => {
  it('renders a labelled hierarchy diagram with the three levels', () => {
    render(<WorkspaceDiagram />)
    expect(screen.getByLabelText(/Hierarchy diagram/)).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Group')).toBeInTheDocument()
    expect(screen.getByText('Tabs')).toBeInTheDocument()
    expect(screen.getByText('Tab A')).toBeInTheDocument()
    expect(screen.getByText('Tab B')).toBeInTheDocument()
  })
})
