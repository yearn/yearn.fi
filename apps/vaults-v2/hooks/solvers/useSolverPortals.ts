import { toast } from '@lib/components/yToast'
import { useNotifications } from '@lib/contexts/useNotifications'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import type { TDict, TNormalizedBN } from '@lib/types'
import {
  assert,
  assertAddress,
  isEthAddress,
  isZero,
  isZeroAddress,
  toAddress,
  toBigInt,
  toNormalizedBN,
  zeroNormalizedBN
} from '@lib/utils'
import { allowanceKey } from '@lib/utils/helpers'
import type { TTxResponse, TTxStatus } from '@lib/utils/wagmi'
import { allowanceOf, approveERC20, defaultTxStatus, retrieveConfig, toWagmiProvider } from '@lib/utils/wagmi'
import { isSolverDisabled } from '@vaults-v2/contexts/useSolver'
import { isValidPortalsErrorObject } from '@vaults-v2/hooks/helpers/isValidPortalsErrorObject'
import type { TPortalsEstimate } from '@vaults-v2/hooks/usePortalsApi'
import { getPortalsApproval, getPortalsEstimate, getPortalsTx, PORTALS_NETWORK } from '@vaults-v2/hooks/usePortalsApi'
import type { TInitSolverArgs, TSolverContext } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import { useCallback, useMemo, useRef } from 'react'
import type { Hash, TransactionReceipt } from 'viem'
import { BaseError, isHex, maxUint256, zeroAddress } from 'viem'
import { sendTransaction, switchChain, waitForTransactionReceipt } from 'wagmi/actions'

export type TPortalsQuoteResult = {
  result: TPortalsEstimate | null
  isLoading: boolean
  error?: Error
}

async function getQuote(
  request: TInitSolverArgs,
  zapSlippage: number
): Promise<{ data: TPortalsEstimate | null; error?: Error }> {
  try {
    const network = PORTALS_NETWORK.get(request.chainID)
    let inputToken = request.inputToken.value

    if (isEthAddress(request.inputToken.value)) {
      inputToken = zeroAddress
    }
    if (isZeroAddress(request.outputToken.value)) {
      return { data: null, error: new Error('Invalid buy token') }
    }
    if (isZero(request.inputAmount)) {
      return { data: null, error: new Error('Invalid sell amount') }
    }

    const result = await getPortalsEstimate({
      params: {
        inputToken: `${network}:${toAddress(inputToken)}`,
        outputToken: `${network}:${toAddress(request.outputToken.value)}`,
        inputAmount: toBigInt(request.inputAmount).toString(),
        slippageTolerancePercentage: String(zapSlippage)
      }
    })

    // Validate the response structure
    if (!result?.data) {
      return { data: null, error: new Error('Invalid response from Portals API') }
    }

    return result
  } catch (error) {
    console.error('Portals getQuote error:', error)
    const errorContent =
      error instanceof Error ? error.message : 'Portals.fi zap not possible. Try again later or pick another token.'
    return { data: null, error: new Error(errorContent) }
  }
}

/**************************************************************************************************
 ** The Portals solver is used to deposit and withdraw tokens to/from the vaults when the token the
 ** user wants to deposit or withdraw is not the underlying/expected token. This is for example
 ** when the user wants to deposit DAI into an USDC vault. This solver offer a quick and easy way
 ** to deposit it by swapping the DAI for yvUSDC.
 ** This is NOT a vanilla deposit/withdraw, but a swap using the Portals protocol, which require a
 ** third party to execute the swap, in an asynchronous way, with fees and slippage.
 *************************************************************************************************/
export function useSolverPortals(): TSolverContext {
  const { provider } = useWeb3()
  const { setShouldOpenCurtain } = useNotifications()
  const latestQuote = useRef<TPortalsEstimate | undefined>(undefined)
  const request = useRef<TInitSolverArgs | undefined>(undefined)
  const existingAllowances = useRef<TDict<TNormalizedBN>>({})
  const { zapSlippage } = useYearn()

  /**********************************************************************************************
   ** init will be called when the Portals solver should be used to perform the desired swap.
   ** It will set the request to the provided value, as it's required to get the quote, and will
   ** call getQuote to get the current quote for the provided request.current.
   **********************************************************************************************/
  const init = useCallback(
    async (_request: TInitSolverArgs, shouldLogError?: boolean): Promise<TNormalizedBN | undefined> => {
      try {
        if (isSolverDisabled(Solver.enum.Portals)) {
          return undefined
        }
        /******************************************************************************************
         ** First we need to know which token we are selling to the zap. When we are depositing, we
         ** are selling the inputToken, when we are withdrawing, we are selling the outputToken.
         ** based on that token, different checks are required to determine if the solver can be
         ** used.
         ******************************************************************************************/
        const sellToken = _request.isDepositing ? _request.inputToken : _request.outputToken

        /******************************************************************************************
         ** This first obvious check is to see if the solver is disabled. If it is, we return 0.
         ******************************************************************************************/
        if (isSolverDisabled(Solver.enum.Portals)) {
          return undefined
        }

        /******************************************************************************************
         ** Then, we check if the solver can be used for this specific sellToken. If it can't, we
         ** return 0.
         ** This solveVia array is set via the yDaemon tokenList process. If a solve is not set for
         ** a token, you can contact the yDaemon team to add it.
         ******************************************************************************************/
        if (!sellToken.solveVia?.includes(Solver.enum.Portals)) {
          return undefined
        }

        /******************************************************************************************
         ** Same is the amount is 0. If it is, we return 0.
         ******************************************************************************************/
        if (isZero(_request.inputAmount)) {
          return undefined
        }

        /******************************************************************************************
         ** At this point, we know that the solver can be used for this specific token. We set the
         ** request to the provided value, as it's required to get the quote, and we call getQuote
         ** to get the current quote for the provided request.current.
         ******************************************************************************************/
        request.current = _request
        const { data, error } = await getQuote(_request, zapSlippage)
        if (!data) {
          const errorMessage = error?.message || 'Unknown error'
          if (errorMessage && shouldLogError) {
            console.error(errorMessage)
            toast({
              type: 'error',
              content: `Portals.fi zap not possible: ${errorMessage}`
            })
          }
          return undefined
        }
        latestQuote.current = data
        return toNormalizedBN(data?.outputAmount || 0, request?.current?.outputToken?.decimals || 18)
      } catch (error) {
        // Catch any synchronous errors that might occur during initialization
        console.error('Portals solver init error:', error)
        if (shouldLogError) {
          toast({
            type: 'error',
            content: 'Portals.fi zap initialization failed'
          })
        }
        return undefined
      }
    },
    [zapSlippage]
  )

  /* 🔵 - Yearn Finance **************************************************************************
   ** execute will send the post request to execute the order and wait for it to be executed, no
   ** matter the result. It returns a boolean value indicating whether the order was successful or
   ** not.
   **********************************************************************************************/
  const execute = useCallback(
    async (txHashSetter: (txHash: Hash) => void): Promise<TTxResponse> => {
      if (!request.current || isSolverDisabled(Solver.enum.Portals)) {
        return { isSuccessful: false, error: new Error('Portals solver not available') }
      }

      try {
        assert(provider, 'Provider is not set')
        assert(request.current, 'Request is not set')
        assert(latestQuote.current, 'Quote is not set')
        assert(zapSlippage > 0, 'Slippage cannot be 0')

        let inputToken = request.current.inputToken.value
        if (isEthAddress(request.current.inputToken.value)) {
          inputToken = zeroAddress
        }
        const network = PORTALS_NETWORK.get(request.current.chainID)
        const transaction = await getPortalsTx({
          params: {
            sender: toAddress(request.current.from),
            inputToken: `${network}:${toAddress(inputToken)}`,
            outputToken: `${network}:${toAddress(request.current.outputToken.value)}`,
            inputAmount: toBigInt(request.current.inputAmount).toString(),
            slippageTolerancePercentage: String(zapSlippage),
            validate: 'true'
          }
        })

        if (!transaction.data) {
          const error = new Error('Transaction data was not fetched from Portals!')
          console.error(error.message)
          return { isSuccessful: false, error }
        }

        const {
          tx: { value, to, data, ...rest }
        } = transaction.data
        const wagmiProvider = await toWagmiProvider(provider)

        if (wagmiProvider.chainId !== request.current.chainID) {
          try {
            await switchChain(retrieveConfig(), { chainId: request.current.chainID })
          } catch (error) {
            const chainSwitchError =
              error instanceof BaseError ? new Error(`Chain switch failed: ${error.shortMessage}`) : (error as Error)

            console.error('Chain switch error:', chainSwitchError.message)
            toast({
              type: 'error',
              content: `Portals.fi zap not possible: ${chainSwitchError.message}`
            })
            return { isSuccessful: false, error: chainSwitchError }
          }
        }

        assert(isHex(data), 'Data is not hex')
        assert(wagmiProvider.walletClient, 'Wallet client is not set')
        const hash = await sendTransaction(retrieveConfig(), {
          value: toBigInt(value ?? 0),
          to: toAddress(to),
          data,
          chainId: request.current.chainID,
          ...rest
        })
        txHashSetter(hash)
        const receipt = await waitForTransactionReceipt(retrieveConfig(), {
          chainId: wagmiProvider.chainId,
          confirmations: 2,
          hash
        })
        if (receipt.status === 'success') {
          return { isSuccessful: true, receipt: receipt }
        }
        const txError = new Error('Transaction failed')
        console.error(txError.message)
        return { isSuccessful: false, error: txError }
      } catch (error) {
        let finalError: Error

        if (isValidPortalsErrorObject(error)) {
          const errorMessage = error.response.data.message
          finalError = new Error(`Portals API error: ${errorMessage}`)
          console.error('Portals API error:', errorMessage)
          toast({
            type: 'error',
            content: `Portals.fi zap not possible: ${errorMessage}`
          })
        } else {
          finalError = error instanceof Error ? error : new Error('Unknown Portals execution error')
          console.error('Portals execution error:', finalError.message)
          toast({
            type: 'error',
            content: 'Portals.fi execution failed'
          })
        }

        return { isSuccessful: false, error: finalError }
      }
    },
    [provider, zapSlippage]
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** Format the quote to a normalized value, which will be used for subsequent
   ** process and displayed to the user.
   **************************************************************************/
  const expectedOut = useMemo((): TNormalizedBN => {
    if (!latestQuote?.current?.outputAmount || !request.current || isSolverDisabled(Solver.enum.Portals)) {
      return zeroNormalizedBN
    }
    return toNormalizedBN(latestQuote?.current?.outputAmount, request?.current?.outputToken?.decimals || 18)
  }, [])

  /* 🔵 - Yearn Finance ******************************************************
   ** Retrieve the allowance for the token to be used by the solver. This will
   ** be used to determine if the user should approve the token or not.
   **************************************************************************/
  const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
    if (!latestQuote?.current || !request?.current || isSolverDisabled(Solver.enum.Portals)) {
      return zeroNormalizedBN
    }
    const inputToken = request.current.inputToken.value
    if (isEthAddress(request.current.inputToken.value)) {
      return toNormalizedBN(maxUint256, 18)
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

    try {
      const network = PORTALS_NETWORK.get(request.current.chainID)
      const { data: approval } = await getPortalsApproval({
        params: {
          sender: toAddress(request.current.from),
          inputToken: `${network}:${toAddress(inputToken)}`,
          inputAmount: toBigInt(request.current.inputAmount).toString()
        }
      })

      if (!approval?.context) {
        console.error('Portals approval response invalid or missing context')
        return zeroNormalizedBN
      }

      if (!approval.context.allowance) {
        console.error('Portals approval missing allowance value')
        return zeroNormalizedBN
      }

      existingAllowances.current[key] = toNormalizedBN(
        toBigInt(approval.context.allowance),
        request.current.inputToken.decimals
      )
      return existingAllowances.current[key]
    } catch (error) {
      console.error('Portals allowance error:', error)
      return zeroNormalizedBN
    }
  }, [])

  /* 🔵 - Yearn Finance ******************************************************
   ** Trigger an signature to approve the token to be used by the Portals
   ** solver. A single signature is required, which will allow the spending
   ** of the token by the Portals solver.
   **************************************************************************/
  const onApprove = useCallback(
    async (
      amount = maxUint256,
      txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
      onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
      txHashSetter: (txHash: Hash) => void,
      onError?: (error: Error) => Promise<void>
    ): Promise<void> => {
      if (!request.current || isSolverDisabled(Solver.enum.Portals) || !provider) {
        onError?.(new Error('Request, provider not set or solver disabled'))
        return
      }
      assert(request.current, 'Request is not set')
      assert(request.current.inputToken, 'Input token is not set')
      assert(request.current.inputAmount, 'Input amount is not set')

      try {
        const network = PORTALS_NETWORK.get(request.current.chainID)
        const { data: approval } = await getPortalsApproval({
          params: {
            sender: toAddress(request.current.from),
            inputToken: `${network}:${toAddress(request.current.inputToken.value)}`,
            inputAmount: toBigInt(request.current.inputAmount).toString()
          }
        })

        if (!approval) {
          onError?.(new Error('Portals approval not found'))
          return
        }

        const allowance = await allowanceOf({
          connector: provider,
          chainID: request.current.inputToken.chainID,
          tokenAddress: toAddress(request.current.inputToken.value), //token to approve
          spenderAddress: toAddress(approval.context.spender) //contract to approve
        })
        if (allowance < amount) {
          assertAddress(approval.context.spender, 'spender')
          const result = await approveERC20({
            connector: provider,
            chainID: request.current.chainID,
            contractAddress: request.current.inputToken.value,
            spenderAddress: approval.context.spender,
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
            await onSuccess(result.receipt)
          } else {
            onError?.(result.error as Error)
          }
          return
        }
        await onSuccess()
        return
      } catch (error) {
        console.error(error)
        onError?.(error as Error)
        return
      }
    },
    [provider, setShouldOpenCurtain]
  )

  /* 🔵 - Yearn Finance ******************************************************
   ** This execute function is not an actual deposit/withdraw, but a swap using
   ** the Portals solver. The deposit will be executed by the Portals solver by
   ** simply swapping the input token for the output token.
   **************************************************************************/
  const onExecute = useCallback(
    async (
      txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
      onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
      txHashSetter: (txHash: Hash) => void,
      onError?: (error: Error) => Promise<void>
    ): Promise<void> => {
      assert(provider, 'Provider is not set')

      txStatusSetter({ ...defaultTxStatus, pending: true })
      try {
        const status = await execute(txHashSetter)
        if (status.isSuccessful && status.receipt) {
          txStatusSetter({ ...defaultTxStatus, success: true })
          toast({
            type: 'success',
            content: 'Transaction successful!',
            cta: {
              label: 'View',
              onClick: () => {
                setShouldOpenCurtain(true)
              }
            }
          })
          await onSuccess(status.receipt)
        } else {
          txStatusSetter({ ...defaultTxStatus, error: true })
          toast({
            type: 'error',
            content: 'Portals.fi execution failed',
            cta: {
              label: 'View',
              onClick: () => {
                setShouldOpenCurtain(true)
              }
            }
          })
          onError?.(new Error('Transaction failed'))
        }
      } catch (error) {
        txStatusSetter({ ...defaultTxStatus, error: true })
        toast({
          type: 'error',
          content: 'Portals.fi execution failed',
          cta: {
            label: 'View',
            onClick: () => {
              setShouldOpenCurtain(true)
            }
          }
        })
        onError?.(error as Error)
      } finally {
        setTimeout((): void => txStatusSetter(defaultTxStatus), 3000)
      }
    },
    [execute, provider, setShouldOpenCurtain]
  )

  return useMemo(
    (): TSolverContext => ({
      type: Solver.enum.Portals,
      quote: expectedOut,
      init,
      onRetrieveAllowance,
      onApprove,
      onExecuteDeposit: onExecute,
      onExecuteWithdraw: onExecute
    }),
    [expectedOut, init, onApprove, onExecute, onRetrieveAllowance]
  )
}
