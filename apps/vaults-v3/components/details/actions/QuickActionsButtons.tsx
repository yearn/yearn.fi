import { usePlausible } from '@hooks/usePlausible'
import { Button } from '@lib/components/Button'
import { useNotificationsActions } from '@lib/contexts/useNotificationsActions'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TNormalizedBN } from '@lib/types'
import type { TNotificationType } from '@lib/types/notifications'
import { isZero, toAddress, toBigInt, zeroNormalizedBN } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import { PLAUSIBLE_EVENTS } from '@lib/utils/plausible'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { defaultTxStatus } from '@lib/utils/wagmi'
import type { TActionParams } from '@vaults-v2/contexts/useActionFlow'
import { useActionFlow } from '@vaults-v2/contexts/useActionFlow'
import { useSolver } from '@vaults-v2/contexts/useSolver'
import { useVaultStakingData } from '@vaults-v2/hooks/useVaultStakingData'
import { Solver } from '@vaults-v2/types/solvers'
import { motion } from 'framer-motion'
import type { ReactElement } from 'react'
import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { Hash, TransactionReceipt } from 'viem'
import { maxUint256 } from 'viem'

export function VaultDetailsQuickActionsButtons({
  currentVault,
  hasStakingRewardsLive
}: {
  currentVault: TYDaemonVault
  hasStakingRewardsLive: boolean
}): ReactElement {
  const plausible = usePlausible()
  const { onRefresh } = useWallet()
  const { isAutoStakingEnabled } = useYearn()
  const { address, provider } = useWeb3()
  const [txStatusApprove, setTxStatusApprove] = useState(defaultTxStatus)
  const [txStatusExecuteDeposit, setTxStatusExecuteDeposit] = useState(defaultTxStatus)
  const [txStatusExecuteWithdraw, setTxStatusExecuteWithdraw] = useState(defaultTxStatus)
  const [allowanceFrom, setAllowanceFrom] = useState<TNormalizedBN>(zeroNormalizedBN)
  const [allowanceRouter, setAllowanceRouter] = useState<TNormalizedBN>(zeroNormalizedBN)
  const { actionParams, onChangeAmount, maxDepositPossible, isDepositing } = useActionFlow()
  const location = useLocation()
  const isV3Page = location.pathname.startsWith('/v3')
  const {
    onApprove,
    onExecuteDeposit,
    onExecuteWithdraw,
    onRetrieveAllowance,
    onRetrieveRouterAllowance,
    currentSolver,
    expectedOut,
    isLoadingExpectedOut,
    hash
  } = useSolver()
  const { vaultData } = useVaultStakingData({ currentVault })
  const { handleApproveNotification, handleDepositNotification, handleWithdrawNotification } = useNotificationsActions()

  /**********************************************************************************************
   ** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook
   ** is called when amount/in or out changes. Calls the allowanceFetcher callback.
   *********************************************************************************************/
  const triggerRetrieveAllowance = useAsyncTrigger(async (): Promise<void> => {
    setAllowanceFrom(await onRetrieveAllowance(true))
    setAllowanceRouter((await onRetrieveRouterAllowance?.(true)) || zeroNormalizedBN)
  }, [address, onRetrieveAllowance, onRetrieveRouterAllowance, hash])

  /**********************************************************************************************
   ** The onSuccess callback is called when the deposit or withdraw action is successful. It
   ** refreshes the vaults, the staking contract if available and the user's wallet balances
   ** on the from and to tokens.
   *********************************************************************************************/
  const onSuccess = useCallback(
    async (
      isDeposit: boolean,
      type?: TNotificationType,
      receipt?: TransactionReceipt,
      notificationIdToUpdate?: number
    ): Promise<void> => {
      const { chainID } = currentVault

      if (notificationIdToUpdate) {
        await handleDepositNotification({
          actionParams,
          type,
          receipt,
          status: 'success',
          idToUpdate: notificationIdToUpdate
        })
      }

      // TODO: - UPGRADE - VERIFY THIS
      if (isDeposit) {
        plausible(PLAUSIBLE_EVENTS.DEPOSIT, {
          props: {
            chainID: currentVault.chainID,
            vaultAddress: currentVault.address,
            vaultSymbol: currentVault.symbol,
            amountToDeposit: actionParams.amount?.display || '',
            tokenAddress: actionParams?.selectedOptionFrom?.value || '',
            tokenSymbol: actionParams?.selectedOptionFrom?.symbol || '',
            isZap: Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver,
            action: `Deposit ${actionParams.amount?.display} ${actionParams?.selectedOptionFrom?.symbol} -> ${currentVault.symbol} on chain ${currentVault.chainID}`
          }
        })
      } else {
        plausible(PLAUSIBLE_EVENTS.WITHDRAW, {
          props: {
            chainID: currentVault.chainID,
            vaultAddress: currentVault.address,
            vaultSymbol: currentVault.symbol,
            sharesToWithdraw: actionParams.amount?.display || '',
            tokenAddress: actionParams?.selectedOptionTo?.value || '',
            tokenSymbol: actionParams?.selectedOptionTo?.symbol || '',
            isZap: Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver,
            action: `Withdraw ${actionParams.amount?.display} ${currentVault?.symbol} -> ${actionParams?.selectedOptionTo?.symbol} on chain ${actionParams?.selectedOptionTo?.chainID}`
          }
        })
      }

      if (
        Solver.enum.Vanilla === currentSolver ||
        Solver.enum.PartnerContract === currentSolver ||
        Solver.enum.OptimismBooster === currentSolver ||
        Solver.enum.GaugeStakingBooster === currentSolver ||
        Solver.enum.JuicedStakingBooster === currentSolver ||
        Solver.enum.V3StakingBooster === currentSolver ||
        Solver.enum.InternalMigration === currentSolver
      ) {
        const toRefresh = [
          { address: toAddress(actionParams?.selectedOptionFrom?.value), chainID },
          { address: toAddress(actionParams?.selectedOptionTo?.value), chainID },
          { address: toAddress(currentVault.address), chainID }
        ]
        if (currentVault.staking.available) {
          toRefresh.push({ address: toAddress(currentVault.staking.address), chainID })
        }
        console.log('toRefresh', toRefresh)
        const refreshedBalances = await onRefresh(toRefresh)
        console.log('refreshedBalances', refreshedBalances)
      } else if (Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver) {
        if (isDepositing) {
          onRefresh([{ address: toAddress(actionParams?.selectedOptionTo?.value), chainID }])
        } else {
          onRefresh([{ address: toAddress(actionParams?.selectedOptionFrom?.value), chainID }])
        }
      } else {
        onRefresh([
          { address: toAddress(ETH_TOKEN_ADDRESS), chainID },
          { address: toAddress(actionParams?.selectedOptionFrom?.value), chainID },
          { address: toAddress(actionParams?.selectedOptionTo?.value), chainID }
        ])
      }
      onChangeAmount(zeroNormalizedBN)
    },
    [
      currentVault,
      currentSolver,
      onChangeAmount,
      handleDepositNotification,
      actionParams,
      plausible,
      onRefresh,
      isDepositing
    ]
  )

  /**********************************************************************************************
   ** Trigger an approve web3 action, simply trying to approve `amount` tokens to be used by the
   ** Partner contract or the final vault, in charge of depositing the tokens.
   ** This approve can not be triggered if the wallet is not active (not connected) or if the tx
   ** is still pending.
   *********************************************************************************************/
  const onApproveFrom = useCallback(async (): Promise<void> => {
    const shouldApproveInfinite =
      currentSolver === Solver.enum.PartnerContract ||
      // currentSolver === Solver.enum.Vanilla || TODO: Maybe remove this?
      currentSolver === Solver.enum.InternalMigration

    const id = await handleApproveNotification({ actionParams })
    onApprove(
      shouldApproveInfinite ? maxUint256 : toBigInt(actionParams.amount?.raw),
      setTxStatusApprove,
      async (receipt?: TransactionReceipt): Promise<void> => {
        await handleApproveNotification({
          actionParams,
          receipt,
          status: 'success',
          idToUpdate: id
        })
        await triggerRetrieveAllowance()
      },
      (txHash: Hash) => {
        handleApproveNotification({ actionParams, status: 'pending', idToUpdate: id, txHash })
      },
      async (): Promise<void> => {
        await handleApproveNotification({ actionParams, status: 'error', idToUpdate: id })
      }
    )
  }, [currentSolver, handleApproveNotification, actionParams, onApprove, triggerRetrieveAllowance])

  /**********************************************************************************************
   ** Define the condition for the button to be disabled. The button is disabled if the user is
   ** not connected, if the amount is zero, if the amount is above the maximum possible deposit
   ** or if the expected out is zero.
   *********************************************************************************************/
  const isButtonDisabled =
    (!address && !provider) ||
    isZero(toBigInt(actionParams.amount?.raw)) ||
    (isDepositing &&
      toBigInt(actionParams.amount?.raw) >
        toBigInt(maxDepositPossible(toAddress(actionParams?.selectedOptionFrom?.value)).raw)) ||
    isLoadingExpectedOut

  /**********************************************************************************************
   ** We now need to decide which button to display. Depending on a lot of parameters, we can
   ** display a button to approve the from token, a button to deposit, a button to withdraw or a
   ** button to migrate.
   *********************************************************************************************/
  const isAboveAllowance = toBigInt(actionParams.amount?.raw) > toBigInt(allowanceFrom?.raw)

  if (
    currentVault.version.startsWith('3') &&
    currentVault.migration.available &&
    allowanceRouter?.raw === 0n &&
    (actionParams.amount?.raw ?? 0n) > 0n
  ) {
    return (
      <div className={'rounded-md bg-white p-2 text-xs text-black'}>
        {'To enable migrations out of this vault, please ask Yearn to approve the 4626 router!'}
      </div>
    )
  }

  // Solver: a lot, Action: approve
  if (
    (txStatusApprove.pending || isAboveAllowance) && //If the button is busy or the amount is above the allowance ...
    ((isDepositing && currentSolver === Solver.enum.Vanilla) || // ... and the user is depositing with Vanilla ...
      currentSolver === Solver.enum.InternalMigration || // ... or the user is migrating ...
      currentSolver === Solver.enum.Cowswap || // ... or the user is using Cowswap ...
      currentSolver === Solver.enum.Portals || // ... or the user is using Portals ...
      currentSolver === Solver.enum.PartnerContract || // ... or the user is using the Partner contract ...
      currentSolver === Solver.enum.OptimismBooster || // ... or the user is using the Optimism Booster
      currentSolver === Solver.enum.GaugeStakingBooster || // ... or the user is using the Gauge Staking Booster
      currentSolver === Solver.enum.JuicedStakingBooster || // ... or the user is using the Juiced Staking Booster
      currentSolver === Solver.enum.V3StakingBooster) // ... or the user is using the V3 Staking Booster
    // ... then we need to approve the from token
  ) {
    return (
      <Button
        variant={isV3Page ? 'v3' : undefined}
        className={'w-full'}
        isBusy={txStatusApprove.pending}
        isDisabled={isButtonDisabled || isZero(toBigInt(expectedOut?.raw))}
        onClick={onApproveFrom}
      >
        {'Approve'}
      </Button>
    )
  }

  if (isDepositing || currentSolver === Solver.enum.InternalMigration) {
    if (
      (currentSolver === Solver.enum.OptimismBooster ||
        currentSolver === Solver.enum.GaugeStakingBooster ||
        currentSolver === Solver.enum.JuicedStakingBooster ||
        currentSolver === Solver.enum.V3StakingBooster) &&
      isAutoStakingEnabled &&
      hasStakingRewardsLive
    ) {
      return (
        <Button
          variant={isV3Page ? 'v3' : undefined}
          onClick={async (): Promise<void> => {
            const correctActionParams: TActionParams = {
              ...actionParams,
              selectedOptionTo: {
                ...actionParams.selectedOptionTo,
                symbol: vaultData.stakedGaugeSymbol || 'Staked yVault',
                label: vaultData.stakedGaugeSymbol || 'Staked yVault',
                decimals: vaultData.stakingDecimals || 18,
                chainID: currentVault.chainID,
                value: vaultData.address
              }
            }
            const id = await handleDepositNotification({ actionParams: correctActionParams })
            onExecuteDeposit(
              setTxStatusExecuteDeposit,
              async (receipt?: TransactionReceipt) => onSuccess(true, 'deposit and stake', receipt, id),
              (txHash: Hash) => {
                handleDepositNotification({
                  actionParams: correctActionParams,
                  status: 'pending',
                  idToUpdate: id,
                  txHash
                })
              },
              async () => {
                await handleDepositNotification({
                  actionParams: correctActionParams,
                  status: 'error',
                  idToUpdate: id
                })
              }
            )
          }}
          className={'w-full whitespace-nowrap'}
          isBusy={txStatusExecuteDeposit.pending}
          isDisabled={
            (!address && !provider) ||
            isZero(toBigInt(actionParams.amount?.raw)) ||
            toBigInt(toBigInt(actionParams.amount?.raw)) >
              toBigInt(maxDepositPossible(toAddress(actionParams?.selectedOptionFrom?.value)).raw)
          }
        >
          <motion.div
            key={isAutoStakingEnabled ? 'deposit-stake' : 'deposit-only'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {'Deposit and Stake'}
          </motion.div>
        </Button>
      )
    }
    return (
      <Button
        variant={isV3Page ? 'v3' : undefined}
        onClick={async (): Promise<void> => {
          const id = await handleDepositNotification({ actionParams })
          onExecuteDeposit(
            setTxStatusExecuteDeposit,
            async (receipt?: TransactionReceipt) => onSuccess(true, 'deposit', receipt, id),
            (txHash: Hash) => {
              handleDepositNotification({
                actionParams: actionParams,
                status: 'pending',
                idToUpdate: id,
                txHash
              })
            },
            async () => {
              await handleDepositNotification({ actionParams, status: 'error', idToUpdate: id })
            }
          )
        }}
        className={'w-full'}
        isBusy={txStatusExecuteDeposit.pending}
        isDisabled={isButtonDisabled}
      >
        <motion.div
          key={isDepositing ? 'deposit' : 'migrate'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {isDepositing ? 'Deposit' : 'Migrate'}
        </motion.div>
      </Button>
    )
  }

  return (
    <Button
      variant={isV3Page ? 'v3' : undefined}
      onClick={async (): Promise<void> => {
        const id = await handleWithdrawNotification({ actionParams })
        onExecuteWithdraw(
          setTxStatusExecuteWithdraw,
          async (receipt?: TransactionReceipt) => {
            await handleWithdrawNotification({
              actionParams,
              receipt,
              status: 'success',
              idToUpdate: id
            })
            await onSuccess(false)
          },
          (txHash: Hash) => {
            handleWithdrawNotification({ actionParams, status: 'pending', idToUpdate: id, txHash })
          },
          async () => {
            await handleWithdrawNotification({ actionParams, status: 'error', idToUpdate: id })
          }
        )
      }}
      className={'w-full'}
      isBusy={txStatusExecuteWithdraw.pending}
      isDisabled={isButtonDisabled}
    >
      {'Withdraw'}
    </Button>
  )
}
