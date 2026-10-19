'use client'

import { AccountMenu } from '@yearn/site-header/account'
import { useVaultUserData } from '@yearn/vault-widget'
import { formatWalletAddress, useWalletDisconnect, WalletSurface } from '@yearn/wallet-ui'
import { useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { CONTRACTS, TOKEN_DECIMALS } from '@/lib/ethereum'

function AccountContent({ address, onClose }: { address: Address; onClose: () => void }) {
  const [disconnectError, setDisconnectError] = useState('')
  const { disconnectAsync, isPending: isDisconnecting } = useWalletDisconnect()
  const vaultUserData = useVaultUserData({
    account: address,
    assetAddress: CONTRACTS.usdc,
    vaultAddress: CONTRACTS.fixed,
    chainId: 1
  })
  const positionValue = Number(formatUnits(vaultUserData.depositedValue, TOKEN_DECIMALS)).toLocaleString('en-US', {
    maximumFractionDigits: 2
  })
  const disconnect = async () => {
    if (isDisconnecting) return
    setDisconnectError('')
    try {
      await disconnectAsync()
      onClose()
    } catch {
      setDisconnectError('Unable to disconnect. Please try again.')
    }
  }
  return (
    <>
      {disconnectError && (
        <p role="alert" className="mb-3 text-sm text-error">
          {disconnectError}
        </p>
      )}
      <AccountMenu
        account={{
          address,
          displayName: formatWalletAddress(address),
          isWalletLoading: vaultUserData.isLoading,
          portfolioValue: (
            <>
              {vaultUserData.pricePerShare > 0n ? positionValue : '—'}{' '}
              <span className="text-sm text-text-secondary">USDC</span>
              <span className="block text-xs font-normal text-text-secondary">yTranche position</span>
            </>
          ),
          recentActivity: [],
          onDisconnect: () => void disconnect(),
          onViewPortfolio: () => {
            window.open('https://yearn.fi/portfolio', '_blank', 'noopener,noreferrer')
            onClose()
          },
          onViewAllActivity: () => {
            window.open(`https://etherscan.io/address/${address}#tokentxns`, '_blank', 'noopener,noreferrer')
            onClose()
          }
        }}
      />
    </>
  )
}

export function WalletAccountDropdown({
  address,
  isOpen,
  onClose
}: {
  address?: Address
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <WalletSurface
      isOpen={isOpen && Boolean(address)}
      onClose={onClose}
      themeClassName="ytranche-wallet-ui"
      dialogId="ytranche-wallet-account"
      title="Wallet"
      desktopTop="calc(var(--header-height) + 0.5rem)"
      desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
      triggerSelector="[data-wallet-account-trigger], [data-mobile-nav-trigger]"
    >
      {isOpen && address && <AccountContent key={address} address={address} onClose={onClose} />}
    </WalletSurface>
  )
}
