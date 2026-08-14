import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FaviconImage } from './FaviconImage'

describe('FaviconImage', () => {
  it('renders an img with alt text when a url is provided', () => {
    render(<FaviconImage url="https://react.dev/favicon.ico" title="React" />)
    const img = screen.getByRole('img', { name: 'React favicon' })
    expect(img).toHaveAttribute('src', 'https://react.dev/favicon.ico')
  })

  it('falls back to the first letter when no url is given', () => {
    render(<FaviconImage url="" title="github" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
  })

  it('falls back to "?" for an empty title', () => {
    render(<FaviconImage url="" title="   " />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('falls back to the letter when the image fails to load', () => {
    render(<FaviconImage url="https://broken.example/x.png" title="Example" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('E')).toBeInTheDocument()
  })
})
