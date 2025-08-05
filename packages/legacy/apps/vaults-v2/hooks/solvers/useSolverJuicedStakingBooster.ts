import { useNotifications } from '@lib/contexts/useNotifications'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TDict, TNormalizedBN } from '@lib/types'
import { assert, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { YGAUGES_ZAP_ADDRESS } from '@lib/utils/constants'
import { allowanceKey } from '@lib/utils/helpers'
import type { TTxStatus } from '@lib/utils/wagmi'
import { allowanceOf, approveERC20 } from '@lib/utils/wagmi'
import { isSolverDisabled } from '@vaults-v2/contexts/useSolver'
import type { TInitSolverArgs, TSolverContext } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import { depositAndStake } from '@vaults-v2/utils/actions'
import { getVaultEstimateOut } from '@vaults-v2/utils/getVaultEstimateOut'
import { useCallback, useMemo, useRef } from 'react'
import type { Hash, TransactionReceipt } from 'viem'
import { maxUint256 } from 'viem'

export function useSolverJuicedStakingBooster(): TSolverContext {
	const { provider } = useWeb3()
	const { setShouldOpenCurtain } = useNotifications()
	const latestQuote = useRef<TNormalizedBN | undefined>(undefined)
	const request = useRef<TInitSolverArgs | undefined>(undefined)
	const existingAllowances = useRef<TDict<TNormalizedBN>>({})

	/**********************************************************************************************
	 ** init will be called when the gauge staking booster should be used to perform the desired
	 ** deposit. It will set the request to the provided value, as it's required to get the quote,
	 ** and will call getQuote to get the current quote for the provided request.
	 *********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
		if (isSolverDisabled(Solver.enum.JuicedStakingBooster)) {
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
	}, [])

	/**********************************************************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will be used to
	 ** determine if the user should approve the token or not.
	 *********************************************************************************************/
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
				spenderAddress: toAddress(YGAUGES_ZAP_ADDRESS)
			})
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals)
			return existingAllowances.current[key]
		},
		[provider]
	)

	/**********************************************************************************************
	 ** Trigger an approve web3 action
	 ** This approve can not be triggered if the wallet is not active (not connected) or if the tx
	 ** is still pending.
	 *********************************************************************************************/
	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set')
				assert(request.current.inputToken, 'Input token is not set')

				const result = await approveERC20({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: request.current.inputToken.value,
					spenderAddress: YGAUGES_ZAP_ADDRESS,
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
				if (result.isSuccessful) {
					await onSuccess(result.receipt)
				} else if (onError) {
					await onError(new Error('Approval failed'))
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'))
				}
			}
		},
		[provider, setShouldOpenCurtain]
	)

	/**********************************************************************************************
	 ** Trigger a deposit and stake web3 action, simply trying to zap `amount` tokens via the
	 ** Staking Rewards Zap Contract, to the selected vault.
	 *********************************************************************************************/
	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set')
				assert(request.current.inputAmount, 'Input amount is not set')

				const result = await depositAndStake({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: YGAUGES_ZAP_ADDRESS,
					vaultAddress: request.current.outputToken.value,
					vaultVersion: request.current.version,
					stakingPoolAddress: request.current.stakingPoolAddress,
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
				if (result.isSuccessful) {
					await onSuccess(result.receipt)
				} else if (onError) {
					await onError(new Error('Deposit failed'))
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'))
				}
			}
		},
		[provider, setShouldOpenCurtain]
	)

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.JuicedStakingBooster,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw: async (): Promise<void> => undefined
		}),
		[init, onApprove, onExecuteDeposit, onRetrieveAllowance]
	)
}
