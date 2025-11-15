import { cl } from '@lib/utils'
import type { Token } from '@nextgen/hooks/useTokens'
import { type FC, useState } from 'react'
import type { Address } from 'viem'
import { TokenSelector } from './TokenSelector'

interface Props {
  title?: string
  amount: string | number
  token?: Token
  tokenAddress?: Address
  onTokenChange: (address: Address) => void
  chainId: number
  excludeTokens?: Address[]
  isLoading?: boolean
  showSelector?: boolean
  disabled?: boolean
}

export const ReceiveTokenSelector: FC<Props> = ({
  title = 'You will receive',
  amount,
  token,
  tokenAddress,
  onTokenChange,
  chainId,
  excludeTokens,
  isLoading = false,
  showSelector: allowSelector = true,
  disabled = false
}) => {
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium text-sm">
              {isLoading ? <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /> : amount}
            </span>
            {allowSelector && (
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={disabled}
                className={cl(
                  'px-2 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                  disabled
                    ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-200 text-gray-900 hover:border-gray-300'
                )}
              >
                {token?.symbol || 'Select Token'}
                <svg
                  className={cl('w-3 h-3 transition-transform', showDropdown ? 'rotate-180' : null)}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {!allowSelector && token && <span className="text-sm font-medium text-gray-700">{token.symbol}</span>}
          </div>
        </div>
      </div>
      {allowSelector && (
        <>
          {/* Semi-transparent backdrop with fade animation */}
          <div
            className={cl(
              'absolute inset-0 bg-black/5 rounded-xl z-40 transition-opacity duration-200',
              showDropdown ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          />
          {/* Token selector overlay with slide and fade animation */}
          <div
            className={cl(
              'absolute inset-0 z-50 transition-all duration-300 ease-out',
              showDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
            )}
          >
            <TokenSelector
              value={tokenAddress}
              onChange={(address) => {
                onTokenChange(address)
                setShowDropdown(false)
              }}
              chainId={chainId}
              excludeTokens={excludeTokens}
              onClose={() => setShowDropdown(false)}
            />
          </div>
        </>
      )}
    </>
  )
}
