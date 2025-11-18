import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { cl, exactToSimple, simpleToExact } from '@lib/utils'
import type { useDebouncedInput } from 'apps/nextgen/hooks/useDebouncedInput'
import type { useInput } from 'apps/nextgen/hooks/useInput'
import type { ChangeEvent, FC } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'

interface Props {
  input: ReturnType<typeof useInput> | ReturnType<typeof useDebouncedInput>
  className?: string
  balance?: bigint
  decimals?: number
  symbol?: string
  placeholder?: string
  title?: string
  disabled?: boolean
  errorMessage?: string
  onInputChange?: (value: bigint) => void
  showTokenSelector?: boolean
  onTokenSelectorClick?: () => void
  // Mock USD price for now
  mockUsdPrice?: number
  // Token info for logo
  tokenAddress?: string
  tokenChainId?: number
  // Hide percentage buttons
  hidePercentageButtons?: boolean
  // Zap token display
  zapToken?: {
    symbol: string
    address: string
    chainId: number
    expectedAmount?: string
  }
  onRemoveZap?: () => void
  zapNotificationText?: string
}

export const InputTokenAmountV2: FC<Props> = ({
  input,
  className,
  balance,
  decimals,
  symbol,
  placeholder,
  disabled: _disabled,
  errorMessage,
  onInputChange,
  title = 'Amount',
  showTokenSelector = false,
  onTokenSelectorClick,
  mockUsdPrice = 1.0,
  tokenAddress,
  tokenChainId,
  hidePercentageButtons = false,
  zapToken,
  onRemoveZap,
  zapNotificationText
}) => {
  const account = useAccount()
  const [
    {
      formValue,
      activity: [, setActive],
      ...inputState
    },
    handleChangeInput,
    setFormValue
  ] = input

  const isDebouncing = 'isDebouncing' in inputState ? inputState.isDebouncing : false
  const disabled = _disabled || !account

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleChangeInput(event)
    onInputChange?.(simpleToExact(event.target.value))
  }

  const handleTokenButtonClick = () => {
    if (showTokenSelector && onTokenSelectorClick) {
      onTokenSelectorClick()
    }
  }

  // Calculate USD value
  const usdValue = formValue ? (parseFloat(formValue) * mockUsdPrice).toFixed(2) : '0.00'

  // Calculate percentage amounts
  const handlePercentageClick = (percentage: number) => {
    if (!balance || balance === 0n) {
      setFormValue?.('0')
      return
    }
    const tokenDecimals = decimals ?? input[0].decimals
    const fullAmount = formatUnits(balance, tokenDecimals)
    const percentageAmount = ((+fullAmount * percentage) / 100).toString()
    setFormValue?.(percentageAmount)
  }
  console.log(disabled)
  return (
    <div className={cl('flex flex-col w-full relative', className)}>
      <div className="bg-gray-50 rounded-xl py-2 px-3 flex flex-col gap-3">
        {/* Main content row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Amount input and USD value */}
          <div className="flex-1 min-w-0">
            <label className="text-sm font-medium text-gray-700 block mb-2">{title}</label>
            <div className="flex flex-col gap-1">
              <input
                disabled={disabled}
                placeholder={placeholder ?? '0.00'}
                value={formValue}
                onChange={handleInputChange}
                onFocus={() => setActive(true)}
                onBlur={() => setActive(false)}
                className={cl(
                  'bg-transparent outline-none text-2xl font-medium min-w-0',
                  disabled ? 'text-gray-400' : 'text-gray-900',
                  'placeholder:text-gray-400'
                )}
              />
              <div className="text-sm text-gray-500">${usdValue}</div>
            </div>
          </div>

          {/* Right side - Percentage buttons, token selector, and balance */}
          <div className="flex flex-col items-end gap-2">
            {/* Percentage buttons row */}
            {!hidePercentageButtons && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePercentageClick(25)}
                  className={cl(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    disabled
                      ? 'text-gray-400 bg-transparent cursor-not-allowed'
                      : 'text-gray-500 bg-transparent hover:bg-gray-100'
                  )}
                  disabled={disabled}
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handlePercentageClick(50)}
                  className={cl(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    disabled
                      ? 'text-gray-400 bg-transparent cursor-not-allowed'
                      : 'text-gray-500 bg-transparent hover:bg-gray-100'
                  )}
                  disabled={disabled}
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handlePercentageClick(75)}
                  className={cl(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    disabled
                      ? 'text-gray-400 bg-transparent cursor-not-allowed'
                      : 'text-gray-500 bg-transparent hover:bg-gray-100'
                  )}
                  disabled={disabled}
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => handlePercentageClick(100)}
                  className={cl(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    disabled
                      ? 'text-gray-400 bg-transparent cursor-not-allowed'
                      : 'text-gray-500 bg-transparent hover:bg-gray-100'
                  )}
                  disabled={disabled}
                >
                  Max
                </button>
              </div>
            )}

            {/* Token selector and balance */}
            <div className="flex flex-col items-end gap-1">
              {(symbol || showTokenSelector) && (
                <button
                  type="button"
                  onClick={handleTokenButtonClick}
                  data-token-selector-button
                  disabled={!showTokenSelector && disabled}
                  className={cl(
                    'px-2 py-1 rounded-lg flex items-center gap-2 transition-colors',
                    'text-gray-900 text-2xl font-medium', // Match input text size
                    showTokenSelector
                      ? 'bg-transparent hover:bg-gray-100'
                      : disabled
                        ? 'bg-transparent cursor-not-allowed'
                        : 'bg-transparent'
                  )}
                >
                  {tokenAddress && tokenChainId && (
                    <ImageWithFallback
                      src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${tokenChainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                      alt={symbol ?? ''}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  )}
                  <span>{symbol ?? 'Select Token'}</span>
                  {showTokenSelector && (
                    <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              )}
              {balance !== undefined && symbol && (
                <div className="text-xs text-gray-500">
                  Balance: {exactToSimple(balance, decimals ?? input[0].decimals)} {symbol}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {isDebouncing && (
          <div className="absolute top-4 right-4">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error message */}
        {errorMessage && <div className="text-red-500 text-sm mt-1">{errorMessage}</div>}
      </div>

      {/* Zap Token Section */}
      {zapToken && (
        <div className="mt-3">
          {/* Notification text */}
          {zapNotificationText && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm text-gray-600">{zapNotificationText}</span>
            </div>
          )}

          {/* Zap token display */}
          <div className="bg-gray-50 rounded-xl py-2 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-gray-900 text-2xl font-medium">{zapToken.expectedAmount || '0'}</div>
              </div>

              {/* Right side - Token info */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTokenSelectorClick}
                  disabled={disabled}
                  className={cl(
                    'px-2 py-1 rounded-lg flex items-center gap-2 transition-colors',
                    disabled ? 'bg-transparent cursor-not-allowed' : 'bg-transparent hover:bg-gray-100',
                    'text-gray-900 text-2xl font-medium'
                  )}
                >
                  {zapToken.address && zapToken.chainId && (
                    <ImageWithFallback
                      src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${zapToken.chainId}/${zapToken.address.toLowerCase()}/logo-32.png`}
                      alt={zapToken.symbol}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  )}
                  <span>{zapToken.symbol}</span>
                  <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Remove Zap button */}
            {onRemoveZap && (
              <button
                onClick={onRemoveZap}
                className="text-sm text-gray-500 hover:text-gray-700 mt-2 transition-colors"
              >
                Remove Zap
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
