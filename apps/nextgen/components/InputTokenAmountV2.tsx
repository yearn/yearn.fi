import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { TokenLogo } from '@lib/components/TokenLogo'
import { cl, exactToSimple, simpleToExact } from '@lib/utils'
import type { useDebouncedInput } from 'apps/nextgen/hooks/useDebouncedInput'
import type { useInput } from 'apps/nextgen/hooks/useInput'
import { type ChangeEvent, type FC, useMemo } from 'react'
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
  isMaxButtonLoading?: boolean // Loading state for MAX button
  errorMessage?: string
  onInputChange?: (value: bigint) => void
  onMaxClick?: () => Promise<void> | void // Optional callback when MAX is clicked
  showTokenSelector?: boolean
  onTokenSelectorClick?: () => void
  // USD prices
  inputTokenUsdPrice?: number
  outputTokenUsdPrice?: number
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
    isLoading?: boolean
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
  isMaxButtonLoading = false,
  errorMessage,
  onInputChange,
  onMaxClick,
  title = 'Amount',
  showTokenSelector = false,
  onTokenSelectorClick,
  inputTokenUsdPrice = 0,
  outputTokenUsdPrice = 0,
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

  // Calculate USD value for input token
  const inputUsdValue = formValue ? (parseFloat(formValue) * inputTokenUsdPrice).toFixed(2) : '0.00'

  // Calculate USD value for output token (when zapping)
  const outputUsdValue = useMemo(() => {
    if (!zapToken?.expectedAmount || !outputTokenUsdPrice) return '0.00'
    return (parseFloat(zapToken.expectedAmount) * outputTokenUsdPrice).toFixed(2)
  }, [zapToken?.expectedAmount, outputTokenUsdPrice])

  // Calculate percentage amounts
  const handlePercentageClick = async (percentage: number) => {
    if (!balance || balance === 0n) {
      setFormValue?.('0')
      return
    }

    const tokenDecimals = decimals ?? input[0].decimals

    if (percentage === 100) {
      // If onMaxClick is provided, call it (it will handle setting the input)
      if (onMaxClick) {
        await onMaxClick()
      } else {
        // No onMaxClick, just use balance directly
        setFormValue?.(formatUnits(balance, tokenDecimals))
        onInputChange?.(balance)
      }
      return
    }
    const fullAmount = formatUnits(balance, tokenDecimals)
    const percentageAmount = ((+fullAmount * percentage) / 100).toFixed(tokenDecimals)
    setFormValue?.(percentageAmount)
  }

  return (
    <div className={cl('flex flex-col w-full relative border border-gray-200 rounded-md', className)}>
      <div className="py-2 px-3 flex flex-col gap-1">
        {/* Top row - Title and percentage buttons */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{title}</label>

          {/* Percentage buttons */}
          {!hidePercentageButtons && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePercentageClick(25)}
                className={cl(
                  'px-1 py-0.5 text-xs font-medium rounded transition-colors',
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
                  'px-1 py-0.5 text-xs font-medium rounded transition-colors',
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
                  'px-1 py-0.5 text-xs font-medium rounded transition-colors',
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
                  'px-1 py-0.5 text-xs font-medium rounded transition-colors flex items-center justify-center min-w-[42px]',
                  disabled || isMaxButtonLoading
                    ? 'text-gray-400 bg-transparent cursor-not-allowed'
                    : 'text-gray-500 bg-transparent hover:bg-gray-100'
                )}
                disabled={disabled || isMaxButtonLoading}
              >
                {isMaxButtonLoading ? (
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Max'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Middle row - Input and token selector */}
        <div className="flex items-center gap-2 relative">
          <input
            disabled={disabled}
            placeholder={placeholder ?? '0.00'}
            value={formValue}
            onChange={handleInputChange}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            className={cl(
              'bg-transparent outline-none text-2xl font-medium flex-1 min-w-0',
              disabled ? 'text-gray-400' : 'text-gray-900',
              'placeholder:text-gray-400'
            )}
          />

          {/* Token selector button */}
          {(symbol || showTokenSelector) && (
            <button
              type="button"
              onClick={handleTokenButtonClick}
              data-token-selector-button
              disabled={!showTokenSelector && disabled}
              className={cl(
                'px-2 py-1 rounded-lg flex items-center gap-2 transition-colors',
                'text-gray-900 text-xl font-medium', // Match input text size
                showTokenSelector
                  ? 'bg-transparent hover:bg-gray-100'
                  : disabled
                    ? 'bg-transparent cursor-not-allowed'
                    : 'bg-transparent'
              )}
            >
              {tokenAddress && tokenChainId && (
                <TokenLogo
                  src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${tokenChainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                  tokenSymbol={symbol ?? ''}
                  tokenName={symbol ?? ''}
                  width={32}
                  height={32}
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

          {/* Loading indicator */}
          {isDebouncing && (
            <div className="absolute -right-8">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Bottom row - USD value and balance */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">${inputUsdValue}</div>
          {balance !== undefined && symbol && (
            <div className="text-sm text-gray-500">
              Balance: {exactToSimple(balance, decimals ?? input[0].decimals)} {symbol}
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && <div className="text-red-500 text-sm mt-1">{errorMessage}</div>}
      </div>

      {/* Zap Token Section */}
      {zapToken && (
        <div className="mt-1">
          {/* Notification text */}
          {zapNotificationText && (
            <div className="flex items-center gap-2 px-3">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-sm text-gray-600">{zapNotificationText}</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
          )}

          {/* Zap token display */}
          <div className="rounded-md py-2 px-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {zapToken.isLoading ? (
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <div className="text-gray-500 text-2xl font-medium">{zapToken.expectedAmount || '0'}</div>
                )}
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
                      src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                        zapToken.chainId
                      }/${zapToken.address.toLowerCase()}/logo-32.png`}
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
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">${outputUsdValue}</div>
              {/* Remove Zap button */}
              {onRemoveZap && (
                <button
                  onClick={onRemoveZap}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors self-end"
                >
                  Remove Zap
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
