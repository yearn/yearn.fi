import { type FC, useState } from 'react'
import { zeroAddress } from 'viem'
import { WidgetDeposit } from './WidgetDeposit'
import { WidgetWithdraw } from './WidgetWithdraw'

const Button: FC<{
  children: React.ReactNode
  onClick: () => void
  isActive: boolean
}> = ({ children, onClick, isActive }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 rounded-[10px] font-semibold text-base transition-all duration-200 cursor-pointer ${isActive ? 'bg-white text-black shadow-sm' : 'bg-transparent text-white/80 hover:text-white'}`}
    >
      {children}
    </button>
  )
}

export const Widget: FC = () => {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [vaultAddress, setVaultAddress] = useState<string>('0x028eC7330ff87667b6dfb0D94b954c820195336c')

  const vaultDetails = {
    name: 'Vault 1',
    valueUSD: 0
  }

  return (
    <div className="flex flex-col gap-4 mt-16">
      {vaultDetails?.name ? (
        <div className="bg-blue-500/10 rounded-xl p-4 flex items-center justify-between gap-4 border-blue-500/10 border">
          <div className="flex-1">
            <p className="text-black text-lg font-medium">{vaultDetails.name}</p>
            {!!vaultDetails.valueUSD && (
              <p className="text-sm text-black/60 mt-1">
                {'User Position: '}
                {vaultDetails.valueUSD}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setVaultAddress('')}
            className="text-black/40 hover:text-black transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex">
          <input
            type="text"
            placeholder="Enter vault address"
            value={vaultAddress}
            onChange={(e) => setVaultAddress(e.target.value)}
            className="w-full p-4.5 pr-10 bg-blue-500/10 border border-blue-500/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-blue-500 placeholder:text-blue-500"
          />
          {!!vaultAddress && (
            <button
              type="button"
              onClick={() => setVaultAddress('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className="bg-black/5 rounded-2xl p-1">
        <div className="bg-black/15 p-0.5 rounded-xl flex gap-1 mb-2">
          <Button onClick={() => setMode('deposit')} isActive={mode === 'deposit'}>
            Deposit
          </Button>
          <Button onClick={() => setMode('withdraw')} isActive={mode === 'withdraw'}>
            Withdraw
          </Button>
        </div>
        <div className="bg-white rounded-xl p-2">
          {mode === 'deposit' ? (
            <WidgetDeposit account={zeroAddress} vaultAddress={vaultAddress as `0x${string}` | undefined} />
          ) : (
            <WidgetWithdraw account={zeroAddress} vaultAddress={vaultAddress as `0x${string}` | undefined} />
          )}
        </div>
      </div>
    </div>
  )
}
