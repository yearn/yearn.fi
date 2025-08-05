import {useWeb3} from '@lib/contexts/useWeb3'
import type {TNormalizedBN} from '@lib/types'
import {toAddress, toBigInt, zeroNormalizedBN} from '@lib/utils'
import {hash} from '@lib/utils/helpers'
import {useActionFlow} from '@vaults-v2/contexts/useActionFlow'
import {useSolverCowswap} from '@vaults-v2/hooks/solvers/useSolverCowswap'
import {useSolverGaugeStakingBooster} from '@vaults-v2/hooks/solvers/useSolverGaugeStakingBooster'
import {useSolverInternalMigration} from '@vaults-v2/hooks/solvers/useSolverInternalMigration'
import {useSolverJuicedStakingBooster} from '@vaults-v2/hooks/solvers/useSolverJuicedStakingBooster'
import {useSolverOptimismBooster} from '@vaults-v2/hooks/solvers/useSolverOptimismBooster'
import {useSolverPartnerContract} from '@vaults-v2/hooks/solvers/useSolverPartnerContract'
import {useSolverPortals} from '@vaults-v2/hooks/solvers/useSolverPortals'
import {useSolverV3Router} from '@vaults-v2/hooks/solvers/useSolverV3Router'
import {useSolverV3StakingBooster} from '@vaults-v2/hooks/solvers/useSolverV3StakingBooster'
import {useSolverVanilla} from '@vaults-v2/hooks/solvers/useSolverVanilla'
import type {TInitSolverArgs, TSolver, TSolverContext, TWithSolver} from '@vaults-v2/types/solvers'
import {Solver} from '@vaults-v2/types/solvers'
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import {serialize} from 'wagmi'

export const isSolverDisabled = (key: TSolver): boolean => {
	const solverStatus = {
		[Solver.enum.Vanilla]: false,
		[Solver.enum.PartnerContract]: false,
		[Solver.enum.ChainCoin]: true,
		[Solver.enum.InternalMigration]: false,
		[Solver.enum.OptimismBooster]: false,
		[Solver.enum.GaugeStakingBooster]: false,
		[Solver.enum.JuicedStakingBooster]: false,
		[Solver.enum.V3StakingBooster]: false,
		[Solver.enum.Cowswap]: true,
		[Solver.enum.Portals]: false,
		[Solver.enum.None]: false
	}
	return solverStatus[key as typeof Solver.enum.Vanilla] || false
}

type TUpdateSolverHandler = {
	currentNonce: number
	request: TInitSolverArgs
	quote: PromiseSettledResult<TNormalizedBN | undefined>
	solver: TSolver
	ctx: TSolverContext
}

const DefaultWithSolverContext: TWithSolver = {
	currentSolver: Solver.enum.Vanilla,
	effectiveSolver: Solver.enum.Vanilla,
	expectedOut: undefined,
	hash: undefined,
	isLoadingExpectedOut: false,
	onRetrieveAllowance: async (): Promise<TNormalizedBN> => zeroNormalizedBN,
	onApprove: async (): Promise<void> => Promise.resolve(),
	onExecuteDeposit: async (): Promise<void> => Promise.resolve(),
	onExecuteWithdraw: async (): Promise<void> => Promise.resolve()
}

const WithSolverContext = createContext<TWithSolver>(DefaultWithSolverContext)
export function WithSolverContextApp({children}: {children: React.ReactElement}): React.ReactElement {
	const {address} = useWeb3()
	const {currentVault, actionParams, currentSolver, isDepositing} = useActionFlow()
	const executionNonce = useRef<number>(0)
	const cowswap = useSolverCowswap()
	const vanilla = useSolverVanilla()
	const portals = useSolverPortals()
	const partnerContract = useSolverPartnerContract()
	const internalMigration = useSolverInternalMigration()
	const optimismBooster = useSolverOptimismBooster()
	const veYFIGaugeStakingBooster = useSolverGaugeStakingBooster()
	const juicedStakingBooster = useSolverJuicedStakingBooster()
	const v3StakingBooster = useSolverV3StakingBooster()
	const v3Router = useSolverV3Router()
	const [currentSolverState, setCurrentSolverState] = useState<TSolverContext & {hash?: string}>(vanilla)
	const [isLoading, setIsLoading] = useState(false)

	const handleUpdateSolver = useCallback(
		async ({currentNonce, request, quote, solver, ctx}: TUpdateSolverHandler): Promise<void> => {
			if (quote.status !== 'fulfilled') {
				return
			}
			if (currentNonce !== executionNonce.current) {
				return
			}
			const requestHash = await hash(serialize({...request, solver, expectedOut: toBigInt(quote.value?.raw)}))
			setCurrentSolverState({
				...ctx,
				quote: quote.value,
				hash: requestHash
			})
			setIsLoading(false)
		},
		[]
	)

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Based on the currentSolver, we initialize the solver with the required parameters.
	 **********************************************************************************************/
	const onUpdateSolver = useCallback(
		async (currentNonce: number): Promise<void> => {
			if (
				!actionParams?.selectedOptionFrom ||
				!actionParams?.selectedOptionTo ||
				actionParams?.amount === undefined
			) {
				return
			}
			if (actionParams.amount.raw === 0n) {
				return setCurrentSolverState({...vanilla, quote: zeroNormalizedBN})
			}

			setIsLoading(true)

			const request: TInitSolverArgs = {
				chainID: currentVault.chainID,
				version: currentVault.version,
				from: toAddress(address || ''),
				inputToken: actionParams.selectedOptionFrom,
				outputToken: actionParams.selectedOptionTo,
				inputAmount: actionParams.amount.raw,
				isDepositing: isDepositing,
				stakingPoolAddress:
					currentVault.staking.available &&
					(currentVault.staking.source === 'VeYFI' || currentVault.staking.source === 'Juiced')
						? toAddress(currentVault.staking.address)
						: undefined
			}

			const isValidSolver = ({
				quote,
				solver
			}: {
				quote: PromiseSettledResult<TNormalizedBN | undefined>
				solver: TSolver
			}): boolean => {
				return quote.status === 'fulfilled' && toBigInt(quote.value?.raw) > 0n && !isSolverDisabled(solver)
			}

			switch (currentSolver) {
				case Solver.enum.Portals: {
					const [portalsQuote] = await Promise.allSettled([
						portals.init(request, currentSolver === Solver.enum.Portals)
					])

					const solvers: {
						[key in TSolver]?: {
							quote: PromiseSettledResult<TNormalizedBN | undefined>
							ctx: TSolverContext
						}
					} = {}

					;[
						{
							solver: Solver.enum.Portals,
							quote: portalsQuote,
							ctx: portals
						}
					].forEach(({solver, quote, ctx}): void => {
						if (isValidSolver({quote, solver})) {
							solvers[solver] = {quote, ctx}
						}
					})

					solvers[Solver.enum.None] = {
						quote: {status: 'fulfilled', value: zeroNormalizedBN},
						ctx: vanilla
					}

					const solverPriority = [Solver.enum.Portals, Solver.enum.None]
					const newSolverPriority = [
						currentSolver,
						...solverPriority.filter((solver): boolean => solver !== currentSolver)
					]

					for (const solver of newSolverPriority) {
						if (!solvers[solver]) {
							continue
						}

						const result = solvers[solver] ?? solvers[Solver.enum.None]
						if (result) {
							const {quote, ctx} = result
							await handleUpdateSolver({
								currentNonce,
								request,
								quote,
								solver,
								ctx
							})
						}
						return
					}
					break
				}
				case Solver.enum.Cowswap: {
					const [cowswapQuote] = await Promise.allSettled([
						cowswap.init(request, currentSolver === Solver.enum.Cowswap)
					])

					const solvers: {
						[key in TSolver]?: {
							quote: PromiseSettledResult<TNormalizedBN | undefined>
							ctx: TSolverContext
						}
					} = {}

					;[
						{
							solver: Solver.enum.Cowswap,
							quote: cowswapQuote,
							ctx: cowswap
						}
					].forEach(({solver, quote, ctx}): void => {
						if (isValidSolver({quote, solver})) {
							solvers[solver] = {quote, ctx}
						}
					})

					solvers[Solver.enum.None] = {
						quote: {status: 'fulfilled', value: zeroNormalizedBN},
						ctx: vanilla
					}

					const solverPriority = [Solver.enum.Cowswap, Solver.enum.None]
					const newSolverPriority = [
						currentSolver,
						...solverPriority.filter((solver): boolean => solver !== currentSolver)
					]

					for (const solver of newSolverPriority) {
						if (!solvers[solver]) {
							continue
						}

						const result = solvers[solver] ?? solvers[Solver.enum.None]
						if (result) {
							const {quote, ctx} = result
							await handleUpdateSolver({
								currentNonce,
								request,
								quote,
								solver,
								ctx
							})
						}
						return
					}
					break
				}
				case Solver.enum.OptimismBooster: {
					const [quote] = await Promise.allSettled([optimismBooster.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.OptimismBooster,
						ctx: optimismBooster
					})
					break
				}
				case Solver.enum.GaugeStakingBooster: {
					const [quote] = await Promise.allSettled([veYFIGaugeStakingBooster.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.GaugeStakingBooster,
						ctx: veYFIGaugeStakingBooster
					})
					break
				}
				case Solver.enum.JuicedStakingBooster: {
					const [quote] = await Promise.allSettled([juicedStakingBooster.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.JuicedStakingBooster,
						ctx: juicedStakingBooster
					})
					break
				}
				case Solver.enum.V3StakingBooster: {
					const [quote] = await Promise.allSettled([v3StakingBooster.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.V3StakingBooster,
						ctx: v3StakingBooster
					})
					break
				}
				case Solver.enum.PartnerContract: {
					const [quote] = await Promise.allSettled([partnerContract.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.PartnerContract,
						ctx: partnerContract
					})
					break
				}
				case Solver.enum.InternalMigration: {
					request.migrator = currentVault.migration.contract
					request.asset = currentVault.token.address
					const ctx = currentVault.version.startsWith('3') ? v3Router : internalMigration
					const [quote] = await Promise.allSettled([ctx.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.InternalMigration,
						ctx
					})
					break
				}
				default: {
					const [quote] = await Promise.allSettled([vanilla.init(request)])
					await handleUpdateSolver({
						currentNonce,
						request,
						quote,
						solver: Solver.enum.Vanilla,
						ctx: vanilla
					})
				}
			}
		},
		[
			actionParams.selectedOptionFrom,
			actionParams.selectedOptionTo,
			actionParams.amount,
			currentVault.chainID,
			currentVault.version,
			currentVault.staking.available,
			currentVault.staking.source,
			currentVault.staking.address,
			currentVault.migration.contract,
			currentVault.token.address,
			address,
			isDepositing,
			currentSolver,
			vanilla,
			cowswap,
			portals,
			handleUpdateSolver,
			optimismBooster,
			veYFIGaugeStakingBooster,
			juicedStakingBooster,
			v3StakingBooster,
			partnerContract,
			internalMigration,
			v3Router
		]
	)

	useEffect((): void => {
		const currentNonce = ++executionNonce.current
		onUpdateSolver(currentNonce)
	}, [onUpdateSolver])

	const contextValue = useMemo(
		(): TWithSolver => ({
			currentSolver: currentSolver,
			effectiveSolver: currentSolverState?.type,
			expectedOut: currentSolverState?.quote,
			hash: currentSolverState?.hash,
			isLoadingExpectedOut: isLoading,
			onRetrieveAllowance: currentSolverState.onRetrieveAllowance,
			onRetrieveRouterAllowance: currentSolverState.onRetrieveRouterAllowance,
			onApprove: currentSolverState.onApprove,
			onExecuteDeposit: currentSolverState.onExecuteDeposit,
			onExecuteWithdraw: currentSolverState.onExecuteWithdraw
		}),
		[
			currentSolver,
			currentSolverState?.hash,
			currentSolverState.onApprove,
			currentSolverState.onExecuteDeposit,
			currentSolverState.onExecuteWithdraw,
			currentSolverState.onRetrieveAllowance,
			currentSolverState.onRetrieveRouterAllowance,
			currentSolverState?.quote,
			currentSolverState?.type,
			isLoading
		]
	)

	return <WithSolverContext.Provider value={contextValue}>{children}</WithSolverContext.Provider>
}

export const useSolver = (): TWithSolver => useContext(WithSolverContext)
