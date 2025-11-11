import { cl } from '@lib/utils'
import { type FC, useState } from 'react'

type TabType = 'deposit' | 'withdraw'

export const DepositGeneric: FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('deposit')
  const [amount, setAmount] = useState('1000')
  const [selectedToken, setSelectedToken] = useState('USDC')

  // Mock data
  const balance = '2000 USDC'
  const vaultShares = '935 Vault Shares'
  const annualReturn = '~100 USDC'

  return (
    <div className="bg-white border border-gray-200 rounded-lg size-full">
      <div className="flex flex-col size-full">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between">
          <div className="bg-gray-100 flex flex-1 h-12 items-center justify-center rounded-lg p-0">
            <button
              onClick={() => setActiveTab('deposit')}
              className={cl(
                'flex flex-1 gap-2 h-full items-center justify-center px-3 py-1 rounded-md font-medium text-sm transition-all',
                activeTab === 'deposit' ? 'bg-white text-gray-900 shadow-sm' : 'bg-zinc-100 text-gray-900'
              )}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={cl(
                'flex flex-1 gap-2 h-full items-center justify-center px-3 py-1 rounded-md font-medium text-sm transition-all',
                activeTab === 'withdraw' ? 'bg-white text-gray-900 shadow-sm' : 'bg-zinc-100 text-gray-900'
              )}
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 px-6 pt-6 pb-0 shadow-sm">
          {/* Amount Input */}
          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-end">
                  <label className="font-medium text-sm text-gray-900">Amount</label>
                  <p className="text-[10px] text-zinc-500 font-medium">Balance: {balance}</p>
                </div>
                <div className="relative flex items-center">
                  <div className="bg-white border border-gray-200 rounded-md h-9 flex-1 mr-2">
                    <div className="flex gap-1 h-9 items-center px-3 py-1">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="flex-1 font-normal text-sm text-gray-900 outline-none bg-transparent"
                        placeholder="0"
                      />
                      <span className="text-sm text-zinc-500 font-normal">{selectedToken}</span>
                    </div>
                  </div>
                  <button className="bg-white border border-gray-200 flex gap-2 h-9 items-center justify-center px-8 py-2 rounded-md">
                    <span className="font-medium text-sm text-gray-900">Max</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Token Selection and Details */}
        <div className="px-6 pt-6">
          {/* Deposit Token Selector */}
          <div className="flex flex-col gap-2 mb-6">
            <label className="font-medium text-sm text-gray-900">Deposit Token</label>
            <div className="bg-white border border-gray-200 rounded-md h-9 relative">
              <button className="flex h-9 items-center justify-between px-3 py-2 w-full">
                <span className="font-normal text-sm text-gray-900">{selectedToken}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">You will deposit</p>
              <p className="text-sm text-gray-900">
                {amount} {selectedToken}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">You will receive</p>
              <p className="text-sm text-gray-900">{vaultShares} (?)</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Est. Annual Return</p>
              <p className="text-sm text-gray-900">{annualReturn} (?)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
