import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useWeb3 } from '@lib/contexts/useWeb3'
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
  const { openLoginModal } = useWeb3()
  const [
    {
      formValue,
      activity: [, setActive]
    },
    handleChangeInput,
    setFormValue
  ] = input

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
    <div className={cl('flex flex-col w-full relative border border-border rounded-md group', className)}>
      <div className="py-2 px-3 flex flex-col gap-1">
        {/* Top row - Title and percentage buttons */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">{title}</label>

          {/* Percentage buttons */}
          {!hidePercentageButtons && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePercentageClick(25)}
                className={cl(
                  'px-1 py-0.5 text-xs font-medium rounded bg-surface-secondary transition-all scale-95 active:scale-90',
                  disabled ? 'text-text-tertiary cursor-not-allowed' : 'text-text-secondary hover:scale-100'
                )}
                disabled={disabled}
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handlePercentageClick(50)}
                className={cl(
                  'px-1 py-0.5 text-xs font-medium rounded bg-surface-secondary transition-all scale-95 active:scale-90',
                  disabled ? 'text-text-tertiary cursor-not-allowed' : 'text-text-secondary hover:scale-100'
                )}
                disabled={disabled}
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handlePercentageClick(75)}
                className={cl(
                  'px-1 py-0.5 text-xs font-medium rounded bg-surface-secondary transition-all scale-95 active:scale-90',
                  disabled ? 'text-text-tertiary cursor-not-allowed' : 'text-text-secondary hover:scale-100'
                )}
                disabled={disabled}
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handlePercentageClick(100)}
                className={cl(
                  'px-1 py-0.5 text-xs font-medium rounded bg-surface-secondary transition-all scale-95 active:scale-90 flex items-center justify-center min-w-[42px]',
                  disabled || isMaxButtonLoading
                    ? 'text-text-tertiary cursor-not-allowed'
                    : 'text-text-secondary hover:scale-100'
                )}
                disabled={disabled || isMaxButtonLoading}
              >
                {isMaxButtonLoading ? (
                  <div className="w-3 h-3 border-2 border-border border-t-transparent rounded-full animate-spin" />
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
              'bg-transparent outline-none text-2xl font-medium flex-1 min-w-0 transition-colors duration-200',
              errorMessage ? 'text-red-500' : disabled ? 'text-text-secondary' : 'text-text-primary',
              'placeholder:text-text-secondary'
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
                'text-text-primary text-xl font-medium', // Match input text size
                showTokenSelector
                  ? 'bg-transparent hover:bg-surface-secondary'
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
        </div>

        {/* Bottom row - USD value (or error) and balance */}
        <div className="flex items-center justify-between">
          {errorMessage ? (
            <div className="text-sm text-red-500">{errorMessage}</div>
          ) : (
            <div className="text-sm text-text-secondary">${inputUsdValue}</div>
          )}
          {!account.address ? (
            <button
              type="button"
              onClick={openLoginModal}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Connect wallet
            </button>
          ) : (
            balance !== undefined &&
            balance !== 0n &&
            symbol && (
              <button
                type="button"
                onClick={() => handlePercentageClick(100)}
                disabled={disabled || isMaxButtonLoading}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors disabled:cursor-not-allowed"
              >
                Balance: {exactToSimple(balance, decimals ?? input[0].decimals)} {symbol}
              </button>
            )
          )}
        </div>
      </div>

      {/* Zap Token Section */}
      {zapToken && (
        <div className="mt-1">
          {/* Notification text */}
          {zapNotificationText && (
            <div className="flex items-center gap-2 px-3">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-sm text-text-secondary">{zapNotificationText}</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>
          )}

          {/* Zap token display */}
          <div className="rounded-md py-2 px-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {zapToken.isLoading ? (
                  <div className="h-8 w-24 bg-surface-secondary rounded animate-pulse" />
                ) : (
                  <div className="text-text-secondary text-2xl font-medium">{zapToken.expectedAmount || '0'}</div>
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
                    disabled ? 'bg-transparent cursor-not-allowed' : 'bg-transparent hover:bg-surface-secondary',
                    'text-text-primary text-2xl font-medium'
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
              <div className="text-sm text-text-secondary">${outputUsdValue}</div>
              {/* Remove Zap button - appears on hover */}
              {onRemoveZap && (
                <button
                  type="button"
                  onClick={onRemoveZap}
                  className={cl(
                    'px-1 py-0.5 text-xs font-medium rounded bg-surface-secondary transition-all scale-95 active:scale-90',
                    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    disabled ? 'text-text-tertiary cursor-not-allowed' : 'text-text-secondary hover:scale-100'
                  )}
                  disabled={disabled}
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
