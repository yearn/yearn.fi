import { useNotifications } from '@lib/contexts/useNotifications'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TDict, TNormalizedBN } from '@lib/types'
import { assert, toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { allowanceKey } from '@lib/utils/helpers'
import type { TTxStatus } from '@lib/utils/wagmi'
import { allowanceOf, approveERC20, retrieveConfig, toWagmiProvider } from '@lib/utils/wagmi'
import { migrateSharesViaRouter } from '@lib/utils/wagmi/actions'
import type { TInitSolverArgs, TSolverContext } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import { getVaultEstimateOut } from '@vaults-v2/utils/getVaultEstimateOut'
import { useCallback, useMemo, useRef } from 'react'
import type { Hash, TransactionReceipt } from 'viem'
import { erc20Abi, maxUint256, zeroAddress } from 'viem'
import type { Connector } from 'wagmi'
import { readContract } from 'wagmi/actions'

async function allowanceOfRouter(request: TInitSolverArgs, provider: Connector | undefined): Promise<bigint> {
	if (!request || !provider) {
		return 0n
	}

	const wagmiProvider = await toWagmiProvider(provider)
	const result = await readContract(retrieveConfig(), {
		...wagmiProvider,
		chainId: request.chainID,
		abi: erc20Abi,
		address: request.asset ?? zeroAddress,
		functionName: 'allowance',
		args: [request.migrator ?? zeroAddress, request.outputToken.value]
	})
	return result || 0n
}

export function useSolverV3Router(): TSolverContext {
	const { provider } = useWeb3()
	const { maxLoss } = useYearn()
	const { setShouldOpenCurtain } = useNotifications()
	const latestQuote = useRef<TNormalizedBN | undefined>(undefined)
	const request = useRef<TInitSolverArgs | undefined>(undefined)
	const existingAllowances = useRef<TDict<TNormalizedBN>>({})

	const init = useCallback(
		async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
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
				from: toAddress(_request.from),
				maxLoss: maxLoss
			})
			latestQuote.current = estimateOut
			return latestQuote.current
		},
		[maxLoss]
	)

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
				spenderAddress: toAddress(request.current.migrator)
			})
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals)
			return existingAllowances.current[key]
		},
		[provider]
	)

	const onRetrieveRouterAllowance = useCallback(
		async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
			if (!request?.current || !provider || !request.current.asset || !request.current.migrator) {
				return zeroNormalizedBN
			}

			const key = allowanceKey(
				request.current.chainID,
				toAddress(request.current.asset),
				toAddress(request.current.migrator),
				toAddress(request.current.outputToken.value)
			)
			if (existingAllowances.current[key] && !shouldForceRefetch) {
				return existingAllowances.current[key]
			}

			const allowance = await allowanceOfRouter(request.current, provider)
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals)
			return existingAllowances.current[key]
		},
		[provider]
	)

	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set')
			assert(request.current.inputToken, 'Input token is not set')
			assert(request.current.outputToken, 'Output token is not set')

			try {
				const result = await approveERC20({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: request.current.inputToken.value,
					spenderAddress: request.current.migrator,
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

	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set')
			assert(request.current.inputToken, 'Output token is not set')
			assert(request.current.inputAmount, 'Input amount is not set')

			try {
				const result = await migrateSharesViaRouter({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: request.current.inputToken.value,
					router: request.current.migrator,
					fromVault: request.current.inputToken.value,
					toVault: request.current.outputToken.value,
					amount: request.current.inputAmount,
					maxLoss,
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
			return
		},
		[provider, maxLoss, setShouldOpenCurtain]
	)

	const onExecuteWithdraw = useCallback(async (): Promise<void> => {
		throw new Error('Not implemented')
	}, [])

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.Vanilla,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
			onRetrieveRouterAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw
		}),
		[init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, onRetrieveRouterAllowance]
	)
}
