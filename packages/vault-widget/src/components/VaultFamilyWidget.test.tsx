import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { VaultWidgetFamilyPreset } from '../types'
import { VaultFamilyWidget } from './VaultFamilyWidget'

const family: VaultWidgetFamilyPreset = {
  id: 'test-family',
  name: 'Test family',
  defaultVariant: 'unlocked',
  variants: [
    {
      id: 'unlocked',
      label: 'Unlocked',
      available: false,
      unavailableMessage: 'Unavailable in this fixture.'
    },
    {
      id: 'locked',
      label: 'Locked',
      available: false,
      description: 'This variant launches later.',
      unavailableMessage: 'Locked is not live yet.'
    }
  ]
}

describe('VaultFamilyWidget', () => {
  it('renders an accessible selector and the default unavailable state', () => {
    const markup = renderToStaticMarkup(<VaultFamilyWidget family={family} />)

    expect(markup).toContain('aria-label="Vault variant"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Unavailable in this fixture.')
  })

  it('supports a controlled unavailable variant', () => {
    const markup = renderToStaticMarkup(<VaultFamilyWidget family={family} variant="locked" />)

    expect(markup).toContain('Locked is not live yet.')
    expect(markup).toContain('This variant launches later.')
  })
})
