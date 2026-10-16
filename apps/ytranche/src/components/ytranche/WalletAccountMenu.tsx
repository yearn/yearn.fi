'use client'

import { useVaultUserData } from '@yearn/vault-widget'
import { formatWalletAddress, useWalletDisconnect, WalletAccountPanel, WalletSurface } from '@yearn/wallet-ui'
import { useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { CONTRACTS, TOKEN_DECIMALS } from '@/lib/ethereum'
import { useThemePreference } from '@/lib/theme'

type TAccountContentProps = { address: Address; onClose: () => void }

function AccountContent({ address, onClose }: TAccountContentProps) {
  const [theme, changeTheme] = useThemePreference()
  const [view, setView] = useState<'account' | 'settings'>('account')
  const [copyStatus, setCopyStatus] = useState('')
  const [disconnectError, setDisconnectError] = useState('')
  const { disconnectAsync, isPending: isDisconnecting } = useWalletDisconnect()
  const vaultUserData = useVaultUserData({
    account: address,
    assetAddress: CONTRACTS.usdc,
    vaultAddress: CONTRACTS.fixed,
    chainId: 1
  })
  const isDarkTheme = theme === 'dark'
  const positionValue = Number(formatUnits(vaultUserData.depositedValue, TOKEN_DECIMALS)).toLocaleString('en-US', {
    maximumFractionDigits: 2
  })
  const showView = (nextView: 'account' | 'settings') => {
    setView(nextView)
    requestAnimationFrame(() =>
      document
        .getElementById(nextView === 'settings' ? 'ytranche-wallet-settings-back' : 'ytranche-wallet-settings')
        ?.focus()
    )
  }
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopyStatus('Address copied')
    } catch {
      setCopyStatus('Unable to copy address')
    }
  }
  const disconnect = async () => {
    setDisconnectError('')
    try {
      await disconnectAsync()
      onClose()
    } catch {
      setDisconnectError('Unable to disconnect. Please try again.')
    }
  }

  if (view === 'settings') {
    return (
      <div className="flex flex-col">
        <div className="mb-4 flex items-center">
          <button
            type="button"
            id="ytranche-wallet-settings-back"
            aria-label="Back to account"
            onClick={() => showView('account')}
            className="flex size-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2">
              <path d="M19 12H5m7 7-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="flex-1 text-center text-base font-semibold text-text-primary">Settings</h2>
          <span aria-hidden className="w-7" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Theme</span>
          <div className={`flex rounded-full p-0.5 ${isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100'}`}>
            {(['light', 'dark'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Use ${option} theme`}
                aria-pressed={theme === option}
                onClick={() => changeTheme(option)}
                className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${theme === option ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {disconnectError && (
        <p role="alert" className="mb-3 text-sm text-red-500">
          {disconnectError}
        </p>
      )}
      <WalletAccountPanel
        address={address}
        displayName={formatWalletAddress(address)}
        isDarkTheme={isDarkTheme}
        isDisconnecting={isDisconnecting}
        onCopyAddress={() => void copyAddress()}
        onDisconnect={() => void disconnect()}
        onSettingsClick={() => showView('settings')}
        settingsButtonId="ytranche-wallet-settings"
        copyStatus={copyStatus}
        value={
          vaultUserData.isLoading ? (
            <div
              role="status"
              aria-label="Loading yTranche position"
              className="mt-1 h-7 w-20 animate-pulse rounded bg-surface-tertiary"
            />
          ) : (
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {vaultUserData.pricePerShare > 0n ? positionValue : '—'}{' '}
                <span className="text-sm text-text-secondary">USDC</span>
              </p>
              <p className="text-xs text-text-secondary">yTranche position</p>
            </div>
          )
        }
        portfolio={
          <a
            href="https://yearn.fi/portfolio"
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${isDarkTheme ? 'border-border bg-transparent text-text-primary hover:bg-surface-tertiary' : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'}`}
          >
            View portfolio <span aria-hidden>→</span>
          </a>
        }
      >
        <a
          href={`https://etherscan.io/address/${address}#tokentxns`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
        >
          View transactions on Etherscan <span aria-hidden>↗</span>
        </a>
      </WalletAccountPanel>
    </>
  )
}

export function WalletAccountMenu({ address, inverse }: { address: Address; inverse: boolean }) {
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null)
  const closeMenu = () => setAnchorElement(null)
  return (
    <>
      <button
        type="button"
        data-wallet-entry="header"
        data-wallet-account-trigger
        aria-label={`Open wallet account ${formatWalletAddress(address)}`}
        aria-controls="ytranche-wallet-account"
        aria-expanded={Boolean(anchorElement)}
        aria-haspopup="dialog"
        className={`wallet-control wallet-control--connected${inverse ? ' wallet-control--inverse' : ''}`}
        onClick={(event) => setAnchorElement(anchorElement ? null : event.currentTarget)}
      >
        <span className="wallet-control__dot" aria-hidden="true" />
        {formatWalletAddress(address)}
      </button>
      <WalletSurface
        anchorElement={anchorElement}
        isOpen={Boolean(anchorElement)}
        onClose={closeMenu}
        dialogId="ytranche-wallet-account"
        title="Wallet"
        themeClassName="ytranche-wallet-ui"
      >
        {anchorElement && <AccountContent address={address} onClose={closeMenu} />}
      </WalletSurface>
    </>
  )
}
