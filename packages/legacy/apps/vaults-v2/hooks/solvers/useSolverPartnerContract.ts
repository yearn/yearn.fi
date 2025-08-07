import { useNotifications } from '@lib/contexts/useNotifications'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TDict, TNormalizedBN } from '@lib/types'
import { assert, assertAddress, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { allowanceKey } from '@lib/utils/helpers'
import type { TTxStatus } from '@lib/utils/wagmi'
import { allowanceOf, approveERC20, getNetwork } from '@lib/utils/wagmi'
import { depositViaPartner, withdrawShares } from '@lib/utils/wagmi/actions'
import { isSolverDisabled } from '@vaults-v2/contexts/useSolver'
import type { TInitSolverArgs, TSolverContext } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import { getVaultEstimateOut } from '@vaults-v2/utils/getVaultEstimateOut'
import { useCallback, useMemo, useRef } from 'react'
import type { Hash, TransactionReceipt } from 'viem'
import { maxUint256 } from 'viem'

export function useSolverPartnerContract(): TSolverContext {
  const { provider } = useWeb3()
  const { currentPartner } = useYearn()
  const { setShouldOpenCurtain } = useNotifications()
  const latestQuote = useRef<TNormalizedBN | undefined>(undefined)
  const request = useRef<TInitSolverArgs | undefined>(undefined)
  const existingAllowances = useRef<TDict<TNormalizedBN>>({})

  /* 🔵 - Yearn Finance **************************************************************************
   ** init will be called when the partner contract solver should be used to deposit.
   ** It will set the request to the provided value, as it's required to get the quote, and will
   ** call getQuote to get the current quote for the provided request.
   **********************************************************************************************/
  const init = useCallback(
    async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
      if (isSolverDisabled(Solver.enum.PartnerContract)) {
        return undefined
      }
      request.current = _request
      const estimateOut = await getVaultEstimateOut({
        inputToken: toAddress(_request.inputToken.value),
        outputToken: toAddress(_request.outputToken.value),
        inputDecimals: _request.inputToken.decimals,
        outputDecimals: _request.outputToken.decimals,
        inputAmount: _request.inputAmount,
        isDepositing: _request.isDepositing,
        chainID: _request.chainID,
        version: _request.version,
        from: toAddress(_request.from)
      })
      latestQuote.current = estimateOut
      return latestQuote.current
    },
    []
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** Retrieve the allowance for the token to be used by the solver. This will
   ** be used to determine if the user should approve the token or not.
   **************************************************************************/
  const onRetrieveAllowance = useCallback(
    async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
      if (!request?.current || !provider) {
        return zeroNormalizedBN
      }

      const key = allowanceKey(
        request.current.chainID,
        toAddress(request.current.inputToken.value),
        toAddress(request.current.outputToken.value),
        toAddress(request.current.from)
      )
      if (existingAllowances.current[key] && !shouldForceRefetch) {
        return existingAllowances.current[key]
      }

      const allowance = await allowanceOf({
        connector: provider,
        chainID: request.current.inputToken.chainID,
        tokenAddress: toAddress(request.current.inputToken.value),
        spenderAddress: toAddress(
          getNetwork(request.current.chainID)?.contracts?.partnerContract?.address
        )
      })
      existingAllowances.current[key] = toNormalizedBN(
        allowance,
        request.current.inputToken.decimals
      )
      return existingAllowances.current[key]
    },
    [provider]
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** Trigger an approve web3 action, simply trying to approve `amount` tokens
   ** to be used by the Partner contract or the final vault, in charge of
   ** depositing the tokens.
   ** This approve can not be triggered if the wallet is not active
   ** (not connected) or if the tx is still pending.
   **************************************************************************/
  const onApprove = useCallback(
    async (
      amount = maxUint256,
      txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
      onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
      txHashSetter: (txHash: Hash) => void,
      onError?: (error: Error) => Promise<void>
    ): Promise<void> => {
      assert(request.current, 'Request is not set')
      assert(request.current?.inputToken, 'Input token is not set')
      const partnerContract = getNetwork(request.current.chainID)?.contracts?.partnerContract
        ?.address
      assertAddress(partnerContract, 'partnerContract')

      try {
        const result = await approveERC20({
          connector: provider,
          chainID: request.current.chainID,
          contractAddress: request.current.inputToken.value,
          spenderAddress: partnerContract,
          amount: amount,
          statusHandler: txStatusSetter,
          txHashHandler: txHashSetter,
          cta: {
            label: 'View',
            onClick: () => {
              setShouldOpenCurtain(true)
            }
          }
        })
        if (result.isSuccessful && result.receipt) {
          onSuccess(result.receipt)
        } else {
          onError?.(result.error as Error)
        }
      } catch (error) {
        onError?.(error as Error)
      }
    },
    [provider, setShouldOpenCurtain]
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** Trigger a deposit web3 action, simply trying to deposit `amount` tokens
   ** via the Partner Contract, to the selected vault.
   **************************************************************************/
  const onExecuteDeposit = useCallback(
    async (
      txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
      onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
      txHashSetter: (txHash: Hash) => void,
      onError?: (error: Error) => Promise<void>
    ): Promise<void> => {
      assert(request.current, 'Request is not set')
      assert(request.current.inputAmount, 'Input amount is not set')
      const partnerContract = getNetwork(request.current.chainID)?.contracts?.partnerContract
        ?.address
      assertAddress(partnerContract, 'partnerContract')

      try {
        const result = await depositViaPartner({
          connector: provider,
          chainID: request.current.chainID,
          contractAddress: partnerContract,
          vaultAddress: request.current.outputToken.value,
          partnerAddress: currentPartner ? currentPartner : undefined,
          amount: request.current.inputAmount,
          statusHandler: txStatusSetter,
          txHashHandler: txHashSetter,
          cta: {
            label: 'View',
            onClick: () => {
              setShouldOpenCurtain(true)
            }
          }
        })
        if (result.isSuccessful && result.receipt) {
          onSuccess(result.receipt)
        } else {
          onError?.(result.error as Error)
        }
      } catch (error) {
        onError?.(error as Error)
      }
    },
    [currentPartner, provider, setShouldOpenCurtain]
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** Trigger a withdraw web3 action using the vault contract to take back
   ** some underlying token from this specific vault.
   **************************************************************************/
  const onExecuteWithdraw = useCallback(
    async (
      txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
      onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
      txHashSetter: (txHash: Hash) => void,
      onError?: (error: Error) => Promise<void>
    ): Promise<void> => {
      assert(request.current, 'Request is not set')
      assert(request.current.inputToken, 'Input token is not set')
      assert(request.current.inputAmount, 'Input amount is not set')

      try {
        const result = await withdrawShares({
          connector: provider,
          chainID: request.current.chainID,
          contractAddress: request.current.inputToken.value,
          amount: request.current.inputAmount,
          statusHandler: txStatusSetter,
          txHashHandler: txHashSetter,
          cta: {
            label: 'View',
            onClick: () => {
              setShouldOpenCurtain(true)
            }
          }
        })
        if (result.isSuccessful && result.receipt) {
          onSuccess(result.receipt)
        } else {
          onError?.(result.error as Error)
        }
      } catch (error) {
        onError?.(error as Error)
      }
    },
    [provider, setShouldOpenCurtain]
  )

  return useMemo(
    (): TSolverContext => ({
      type: Solver.enum.PartnerContract,
      quote: latestQuote?.current || zeroNormalizedBN,
      init,
      onRetrieveAllowance,
      onApprove,
      onExecuteDeposit,
      onExecuteWithdraw
    }),
    [init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance]
  )
}
