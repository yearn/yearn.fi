import { cl, exactToSimple, parseUnits, simpleToExact } from '@lib/utils'
import type { useInput } from 'apps/nextgen/hooks/useInput'
import type { ChangeEvent, FC } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'

interface Props {
  input: ReturnType<typeof useInput>
  className?: string
  balance?: bigint
  defaultSymbol?: string
  symbol?: string
  placeholder?: string
  title?: string
  disabled?: boolean
  errorMessage?: string
  onInputChange?: (value: bigint) => void
  onButtonClick?: () => void
}

export const InputTokenAmount: FC<Props> = ({
  input,
  className,
  balance,
  symbol,
  placeholder,
  disabled: _disabled,
  errorMessage,
  onInputChange,
  onButtonClick,
  title,
  defaultSymbol = 'Select Vault'
}) => {
  const account = useAccount()
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

  return (
    <div className={cl('flex flex-col w-full space-y-1', className)}>
      {title && (
        <div className="flex items-center gap-2 p-1 justify-between">
          <label className="text-sm font-normal text-black">{title}</label>
          <button
            className={
              'font-xs flex-center text-xs px-2 py-1 bg-neutral-700 text-neutral-400 rounded-xl  hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap'
            }
            type="button"
            onClick={() => {
              if (!balance || balance === 0n) {
                setFormValue?.('0')
                return
              }
              setFormValue?.(formatUnits(balance, 18))
            }}
          >
            Max
          </button>
        </div>
      )}
      <div className="bg-black/5 rounded-xl p-3 flex flex-col gap-2">
        <div className={cl('flex flex-row justify-between gap-2 items-center w-full')}>
          <input
            disabled={disabled}
            placeholder={placeholder ?? '0.00'}
            value={formValue}
            onChange={handleInputChange}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            className={cl(
              'flex-grow bg-transparent outline-none text-lg sm:text-[20px] font-mono min-w-0',
              disabled ? 'text-gray-700' : 'text-gray-900',
              'placeholder:text-gray-400'
            )}
          />
          {symbol && (
            <button
              type="button"
              onClick={onButtonClick}
              className="bg-blue-300 text-neutral-900 px-2 sm:px-3 py-1 rounded-xl  font-medium hover:bg-blue-300 transition-colors cursor-pointer whitespace-nowrap max-w-[120px] sm:max-w-none truncate flex-shrink-0"
            >
              {symbol ?? defaultSymbol}
            </button>
          )}
        </div>
        <div className={cl('flex flex-row justify-between gap-2 items-center w-full min-w-0')}>
          <div className="text-xs text-gray-400 truncate min-w-0 flex-1">
            {!symbol ? 'No Vault Selected' : `${exactToSimple(balance, input[0].decimals)} ${symbol}`}
          </div>
        </div>
        {errorMessage && <div className={cl('text-red-500 text-sm', className)}>{errorMessage}</div>}
      </div>
    </div>
  )
}
