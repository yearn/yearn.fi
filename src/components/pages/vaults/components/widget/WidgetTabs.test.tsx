// @vitest-environment jsdom

import { WidgetTabs } from '@pages/vaults/components/widget'
import { WidgetActionType } from '@pages/vaults/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('WidgetTabs', () => {
  it('coordinates host-controlled action, rewards, and My Info modes', () => {
    const onActionChange = vi.fn()
    const onCloseOverlays = vi.fn()
    const onOpenRewards = vi.fn()
    const onOpenWallet = vi.fn()

    render(
      <WidgetTabs
        actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
        activeAction={WidgetActionType.Deposit}
        isRewardsOpen
        isWalletOpen={false}
        onActionChange={onActionChange}
        onCloseOverlays={onCloseOverlays}
        onOpenRewards={onOpenRewards}
        onOpenWallet={onOpenWallet}
      />
    )

    expect(screen.getByRole('tablist', { name: 'Vault action' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Deposit' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: 'Withdraw' }))
    expect(onCloseOverlays).toHaveBeenCalledTimes(1)
    expect(onActionChange).toHaveBeenCalledWith(WidgetActionType.Withdraw)

    fireEvent.click(screen.getByRole('tab', { name: 'Rewards' }))
    expect(onCloseOverlays).toHaveBeenCalledTimes(2)
    expect(onOpenRewards).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('tab', { name: 'My Info' }))
    expect(onCloseOverlays).toHaveBeenCalledTimes(3)
    expect(onOpenWallet).toHaveBeenCalledOnce()

    const rewardsTab = screen.getByRole('tab', { name: 'Rewards' })
    const infoTab = screen.getByRole('tab', { name: 'My Info' })
    rewardsTab.focus()
    fireEvent.keyDown(rewardsTab, { key: 'ArrowRight' })
    expect(onCloseOverlays).toHaveBeenCalledTimes(4)
    expect(onOpenWallet).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(infoTab)
  })
})
