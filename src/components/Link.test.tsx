import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Link from './Link'

describe('Link component', () => {
  it('uses RouterLink for internal navigation', () => {
    render(
      <BrowserRouter>
        <Link href="/vaults">Vaults</Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Vaults')
    expect(link).toHaveAttribute('href', '/vaults')
    expect(link.tagName).toBe('A')
  })

  it('uses RouterLink when "to" prop is provided', () => {
    render(
      <BrowserRouter>
        <Link to="/apps">Apps</Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Apps')
    expect(link).toHaveAttribute('href', '/apps')
  })

  it('falls back to anchor for external URLs with defaults', () => {
    render(
      <BrowserRouter>
        <Link href="https://twitter.com/yearnfi">Twitter</Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Twitter')
    expect(link).toHaveAttribute('href', 'https://twitter.com/yearnfi')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('allows overriding target and rel attributes', () => {
    render(
      <BrowserRouter>
        <Link href="https://docs.yearn.fi" target="_self" rel="noopener">
          Docs
        </Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Docs')
    expect(link).toHaveAttribute('href', 'https://docs.yearn.fi')
    expect(link).toHaveAttribute('target', '_self')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('prioritises href over to prop', () => {
    render(
      <BrowserRouter>
        <Link href="https://docs.yearn.fi" to="/apps">
          Docs
        </Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Docs')
    expect(link).toHaveAttribute('href', 'https://docs.yearn.fi')
  })

  it('applies custom className', () => {
    render(
      <BrowserRouter>
        <Link href="/vaults" className="custom-class">
          Vaults
        </Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Vaults')
    expect(link).toHaveClass('custom-class')
  })

  it('handles onClick event', async () => {
    const user = userEvent.setup()
    let clicked = false
    const handleClick = () => {
      clicked = true
    }

    render(
      <BrowserRouter>
        <Link href="/apps" onClick={handleClick}>
          Apps
        </Link>
      </BrowserRouter>
    )
    const link = screen.getByText('Apps')
    await user.click(link)
    expect(clicked).toBe(true)
  })
})
