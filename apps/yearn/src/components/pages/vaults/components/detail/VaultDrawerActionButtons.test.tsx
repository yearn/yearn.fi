// @vitest-environment jsdom

import { WidgetActionType } from '@pages/vaults/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VaultDrawerActionButtons } from './VaultDrawerActionButtons'

describe('VaultDrawerActionButtons', () => {
  it('renders only Withdraw when it is the only action', () => {
    const onSelect = vi.fn()
    render(<VaultDrawerActionButtons actions={[WidgetActionType.Withdraw]} onSelect={onSelect} isCompactHeader />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Withdraw'])
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(onSelect).toHaveBeenCalledWith(WidgetActionType.Withdraw)
  })

  it('opens the action each button names', () => {
    const onSelect = vi.fn()
    render(
      <VaultDrawerActionButtons
        actions={[WidgetActionType.Migrate, WidgetActionType.Withdraw]}
        onSelect={onSelect}
        isCompactHeader={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Migrate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(onSelect.mock.calls).toEqual([[WidgetActionType.Migrate], [WidgetActionType.Withdraw]])
  })
})
