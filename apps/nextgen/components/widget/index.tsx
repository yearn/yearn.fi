import { type FC, useState } from 'react'
import { zeroAddress } from 'viem'
import { WidgetDeposit } from './WidgetDeposit'
import { WidgetWithdraw } from './WidgetWithdraw'

interface Props {
  vaultAddress?: `0x${string}`
}

export const Widget: FC<Props> = ({ vaultAddress }) => {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')

  return (
    <div className="flex flex-col gap-4 mt-16">
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
