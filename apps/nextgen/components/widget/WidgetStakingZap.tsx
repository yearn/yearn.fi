import Link from '@components/Link'
import { cl, exactToSimple, formatAmount } from '@lib/utils'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import { TxButton } from '@nextgen/components/TxButton'
import { useSolverCowswap } from '@nextgen/hooks/solvers/useSolverCowswap'
import { useSolverGaugeStakingBooster } from '@nextgen/hooks/solvers/useSolverGaugeStakingBooster'
import { useCowswapOrder } from '@nextgen/hooks/useCowswapOrder'
import { useInput } from '@nextgen/hooks/useInput'
import { useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { InputTokenAmount } from '../InputTokenAmount'

interface Props {
  vaultAddress: Address
  gaugeAddress: Address
  vaultType: 'v2' | 'v3'
  vaultVersion?: string
  chainId?: number
  handleSuccess?: () => void
}

type TabType = 'deposit' | 'withdraw'

const TabButton: FC<{
  className?: string
  children: React.ReactNode
  onClick: () => void
  isActive: boolean
}> = ({ children, onClick, isActive, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cl(
        'flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 capitalize',
        isActive
          ? 'bg-white text-gray-900 rounded-bl-none rounded-br-none'
          : 'bg-transparent text-gray-500 hover:text-gray-700',
        className
      )}
    >
      {children}
    </button>
  )
}

export const WidgetStakingZap: FC<Props> = ({
  vaultAddress,
  gaugeAddress,
  vaultType,
  vaultVersion,
  chainId,
  handleSuccess
}) => {
  const { address: account } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('deposit')
  console.log(vaultType)
  // Get asset token from vault
  const { data: assetToken } = useReadContract({
    address: vaultAddress,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: vaultType === 'v2' ? 'token' : 'asset',
    chainId
  })

  const { tokens } = useTokens(assetToken ? [assetToken, gaugeAddress] : [], chainId)

  // ** PERIPHERY ** //
  const [asset, gauge] = tokens

  // Get price per share from vault (this works for both asset-shares and asset-gauge pairs)
  const { data: pricePerShare = 0n } = useReadContract({
    address: vaultAddress,
    abi: vaultType === 'v2' ? vaultAbi : erc4626Abi,
    functionName: 'pricePerShare',
    chainId,
    query: { enabled: !!vaultAddress && !!asset }
  })
  console.log(assetToken)
  console.log(tokens)
  const depositInput = useInput(asset?.decimals ?? 18)
  const withdrawInput = useInput(asset?.decimals ?? 18) // Use asset decimals for withdraw input
  const [depositAmount] = depositInput
  const [withdrawAmount] = withdrawInput

  // ** DEPOSIT & STAKE ACTIONS ** //
  const {
    actions: { prepareApprove: prepareDepositApprove, prepareZapIn },
    periphery: { prepareApproveEnabled: prepareDepositApproveEnabled, prepareZapInEnabled }
  } = useSolverGaugeStakingBooster({
    vaultAddress,
    gaugeAddress,
    tokenAddress: asset?.address as Address,
    amount: depositAmount.bn,
    account,
    chainId,
    vaultVersion,
    enabled: !!assetToken && activeTab === 'deposit'
  })

  // Calculate gauge tokens needed based on asset amount wanted using pricePerShare
  const gaugeTokensNeeded = (() => {
    if (withdrawAmount.bn === 0n || pricePerShare === 0n) return 0n

    // Both V2 and V3 now use the same pricePerShare function
    // pricePerShare returns the asset amount per share unit
    // gaugeTokens = (assetAmount * 1e18) / pricePerShare
    const oneUnit = 10n ** 18n // Always use 18 decimals for share calculations
    return (withdrawAmount.bn * oneUnit) / pricePerShare
  })()

  // Convert gauge balance to asset equivalent using pricePerShare
  const gaugeBalanceInAssets = (() => {
    if (!gauge?.balance.raw || gauge.balance.raw === 0n || pricePerShare === 0n) return 0n

    // Convert gauge tokens to asset amount: assetAmount = (gaugeTokens * pricePerShare) / 1e18
    const oneUnit = 10n ** 18n
    return (gauge.balance.raw * pricePerShare) / oneUnit
  })()

  // Validation checks for overflow amounts
  const isDepositAmountExceedsBalance = depositAmount.bn > (asset?.balance.raw || 0n)
  const isWithdrawAmountExceedsBalance = withdrawAmount.bn > gaugeBalanceInAssets
  console.log(isDepositAmountExceedsBalance, isWithdrawAmountExceedsBalance)
  console.log(depositAmount.bn, asset?.balance.raw)
  console.log(withdrawAmount.bn, gaugeBalanceInAssets)

  // ** COWSWAP SOLVER FOR WITHDRAW (Gauge -> Asset) ** //
  const {
    actions: { prepareApprove: prepareWithdrawApprove },
    periphery: { prepareApproveEnabled: prepareWithdrawApproveEnabled, expectedOut, quote, isLoadingQuote },
    getQuote,
    getCowswapOrderParams
  } = useSolverCowswap({
    sellToken: gaugeAddress, // Sell gauge tokens directly
    buyToken: asset?.address as Address, // Buy underlying asset
    amount: gaugeTokensNeeded, // Use calculated gauge tokens amount
    account,
    chainId,
    decimals: asset?.decimals ?? 18,
    enabled: !!assetToken && !!gauge && activeTab === 'withdraw'
  })

  // Gauge balance is now included in the tokens from useTokens

  // ** COWSWAP ORDER HOOK ** //
  const { prepareCowswapOrder } = useCowswapOrder({
    getCowswapOrderParams,
    enabled: !!quote && gaugeTokensNeeded > 0n
  })

  // Get quote when gauge tokens needed changes
  useEffect(() => {
    if (activeTab === 'withdraw' && gaugeTokensNeeded > 0n) {
      getQuote()
    }
  }, [gaugeTokensNeeded, activeTab, getQuote])

  const depositContent = useMemo(
    () => (
      <div className="p-6 pb-0 space-y-4">
        <InputTokenAmount
          title="Amount to Deposit & Stake"
          input={depositInput}
          placeholder="0.00"
          className="flex-1"
          symbol={asset?.symbol}
          balance={asset?.balance.raw || 0n}
        />

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">You will deposit into</span>
            <Link className="" href={`https://etherscan.io/address/${gaugeAddress}#code`}>
              <span className="text-gray-500 font-medium hover:underline">{gauge?.symbol}</span>
            </Link>
          </div>
        </div>

        <div className="pb-6 pt-2">
          <div className="flex gap-2">
            <TxButton
              prepareWrite={prepareDepositApprove}
              transactionName="Approve"
              disabled={!prepareDepositApproveEnabled || isDepositAmountExceedsBalance}
              className="w-full"
            />
            <TxButton
              prepareWrite={prepareZapIn}
              transactionName="Deposit & Stake"
              disabled={!prepareZapInEnabled || isDepositAmountExceedsBalance}
              onSuccess={handleSuccess}
              className="w-full"
            />
          </div>
        </div>
      </div>
    ),
    [
      depositInput,
      asset?.symbol,
      asset?.balance.raw,
      gauge?.symbol,
      gaugeAddress,
      prepareDepositApprove,
      prepareDepositApproveEnabled,
      prepareZapIn,
      prepareZapInEnabled,
      isDepositAmountExceedsBalance,
      handleSuccess
    ]
  )

  const withdrawContent = useMemo(
    () => (
      <div className="p-6 pb-0 space-y-4">
        <InputTokenAmount
          title="Amount to Withdraw"
          input={withdrawInput}
          placeholder="0.00"
          className="flex-1"
          symbol={asset?.symbol}
          balance={gaugeBalanceInAssets} // Show gauge balance converted to asset equivalent
        />

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">You will burn</span>
            <span className="text-gray-500 font-medium">
              {gaugeTokensNeeded > 0n ? (
                <>
                  {formatAmount(exactToSimple(gaugeTokensNeeded, gauge?.decimals ?? 18))} {gauge?.symbol}
                </>
              ) : (
                <span className="text-gray-400">0 {gauge?.symbol}</span>
              )}
            </span>
          </div>
          {quote && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Via Cowswap</span>
              <span className="text-gray-500 text-xs">Slippage protected</span>
            </div>
          )}
        </div>

        <div className="pb-6 pt-2">
          <div className="flex gap-2">
            <TxButton
              prepareWrite={prepareWithdrawApprove}
              transactionName="Approve"
              disabled={!prepareWithdrawApproveEnabled || isWithdrawAmountExceedsBalance}
              className="w-full"
            />
            <TxButton
              prepareWrite={prepareCowswapOrder}
              transactionName={`Withdraw ${asset?.symbol}`}
              disabled={!quote || gaugeTokensNeeded === 0n || isWithdrawAmountExceedsBalance}
              onSuccess={handleSuccess}
              className="w-full"
            />
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">
            Swap staked {gauge?.symbol} directly to {asset?.symbol} via Cowswap
          </div>
        </div>
      </div>
    ),
    [
      withdrawInput,
      withdrawAmount.bn,
      gaugeTokensNeeded,
      gauge?.symbol,
      gauge?.decimals,
      asset?.symbol,
      asset?.decimals,
      gaugeBalanceInAssets,
      prepareWithdrawApprove,
      prepareWithdrawApproveEnabled,
      expectedOut.raw,
      isLoadingQuote,
      quote,
      prepareCowswapOrder,
      isWithdrawAmountExceedsBalance,
      handleSuccess
    ]
  )

  // Return with wrapper styling to match Widget component
  return (
    <div className="flex flex-col gap-0 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 rounded-lg flex h-12">
          <TabButton isActive={activeTab === 'deposit'} onClick={() => setActiveTab('deposit')}>
            Deposit & Stake
          </TabButton>
          <TabButton isActive={activeTab === 'withdraw'} onClick={() => setActiveTab('withdraw')}>
            Withdraw
          </TabButton>
        </div>
        {activeTab === 'deposit' ? depositContent : withdrawContent}
      </div>
    </div>
  )
}
