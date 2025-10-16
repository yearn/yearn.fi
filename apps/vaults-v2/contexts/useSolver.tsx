import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TNormalizedBN } from '@lib/types'
import { toAddress, toBigInt, zeroNormalizedBN } from '@lib/utils'
import { hash } from '@lib/utils/helpers'
import { useActionFlow } from '@vaults-v2/contexts/useActionFlow'
import { useSolverCowswap } from '@vaults-v2/hooks/solvers/useSolverCowswap'
import { useSolverGaugeStakingBooster } from '@vaults-v2/hooks/solvers/useSolverGaugeStakingBooster'
import { useSolverPortals } from '@vaults-v2/hooks/solvers/useSolverPortals'
import { useSolverVanilla } from '@vaults-v2/hooks/solvers/useSolverVanilla'
import type { TInitSolverArgs, TSolver, TSolverContext, TWithSolver } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export const isSolverDisabled = (key: TSolver): boolean => {
  const solverStatus = {
    [Solver.enum.Vanilla]: false,
    [Solver.enum.PartnerContract]: true,
    [Solver.enum.ChainCoin]: true,
    [Solver.enum.InternalMigration]: false,
    [Solver.enum.OptimismBooster]: true,
    [Solver.enum.GaugeStakingBooster]: false,
    [Solver.enum.JuicedStakingBooster]: true,
    [Solver.enum.V3StakingBooster]: true,
    [Solver.enum.Cowswap]: false,
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
export function WithSolverContextApp({ children }: { children: React.ReactElement }): React.ReactElement {
  const { address } = useWeb3()
  const { currentVault, actionParams, currentSolver, isDepositing } = useActionFlow()
  const executionNonce = useRef<number>(0)
  const cowswap = useSolverCowswap()
  const vanilla = useSolverVanilla()
  const portals = useSolverPortals()
  const veYFIGaugeStakingBooster = useSolverGaugeStakingBooster()
  const [currentSolverState, setCurrentSolverState] = useState<TSolverContext & { hash?: string }>(vanilla)
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdateSolver = useCallback(
    async ({ currentNonce, request, quote, solver, ctx }: TUpdateSolverHandler): Promise<void> => {
      if (quote.status !== 'fulfilled') {
        return
      }
      if (currentNonce !== executionNonce.current) {
        return
      }
      const requestHash = await hash(
        `${request.chainID}-${request.from}-${request.inputToken?.value}-${request.outputToken?.value}-${request.inputAmount}-${solver}-${toBigInt(quote.value?.raw)}`
      )
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
      if (!actionParams?.selectedOptionFrom || !actionParams?.selectedOptionTo || actionParams?.amount === undefined) {
        return
      }
      if (actionParams.amount.raw === 0n) {
        return setCurrentSolverState({ ...vanilla, quote: zeroNormalizedBN })
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
            : undefined,
        vaultTokenAddress:
          currentVault.staking.available && currentVault.staking.source === 'VeYFI'
            ? toAddress(currentVault.address)
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
        case Solver.enum.Portals:
        case Solver.enum.Cowswap: {
          // Chain-based solver selection:
          // - Mainnet (chainID 1): Use Cowswap
          // - Other chains: Use Portals
          const isMainnet = currentVault.chainID === 1

          if (isMainnet) {
            // Mainnet: Only use Cowswap
            const [cowswapQuote] = await Promise.allSettled([cowswap.init(request, true)])

            if (isValidSolver({ quote: cowswapQuote, solver: Solver.enum.Cowswap })) {
              await handleUpdateSolver({
                currentNonce,
                request,
                quote: cowswapQuote,
                solver: Solver.enum.Cowswap,
                ctx: cowswap
              })
            } else {
              // Fallback to vanilla if Cowswap fails
              const [vanillaQuote] = await Promise.allSettled([vanilla.init(request)])
              await handleUpdateSolver({
                currentNonce,
                request,
                quote: vanillaQuote,
                solver: Solver.enum.Vanilla,
                ctx: vanilla
              })
            }
          } else {
            // Non-mainnet: Only use Portals
            const [portalsQuote] = await Promise.allSettled([portals.init(request, true)])

            if (isValidSolver({ quote: portalsQuote, solver: Solver.enum.Portals })) {
              await handleUpdateSolver({
                currentNonce,
                request,
                quote: portalsQuote,
                solver: Solver.enum.Portals,
                ctx: portals
              })
            } else {
              // Fallback to vanilla if Portals fails
              const [vanillaQuote] = await Promise.allSettled([vanilla.init(request)])
              await handleUpdateSolver({
                currentNonce,
                request,
                quote: vanillaQuote,
                solver: Solver.enum.Vanilla,
                ctx: vanilla
              })
            }
          }
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
      address,
      isDepositing,
      currentSolver,
      vanilla,
      cowswap,
      portals,
      handleUpdateSolver,
      veYFIGaugeStakingBooster,

      currentVault.address
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
