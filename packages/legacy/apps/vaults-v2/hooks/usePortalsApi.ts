import { addressSchema, type TAddress } from '@lib/types'
import type { TFetchReturn } from '@lib/utils/fetchers'
import { fetch } from '@lib/utils/fetchers'
import { z } from 'zod'

export const portalsEstimateResponseSchema = z.object({
  outputToken: z.string(),
  outputAmount: z.string(),
  minOutputAmount: z.string(),
  outputTokenDecimals: z.number()
})

export type TPortalsEstimate = z.infer<typeof portalsEstimateResponseSchema>

type TGetEstimateProps = {
  params: {
    inputToken: string
    inputAmount: string
    outputToken: string
    slippageTolerancePercentage: string
  }
}

type TGetTransactionProps = Omit<TGetEstimateProps, 'params'> & {
  params: Required<Pick<TGetEstimateProps, 'params'>['params']> & {
    sender: TAddress
    validate?: string
    feePercentage?: string
  }
}

const portalsTxSchema = z.object({
  to: z.string(),
  from: z.string().optional(),
  data: z.string(),
  value: z.string().optional(),
  gasLimit: z.string()
})

const portalsTransactionSchema = z.object({
  context: z.object({
    orderId: z.string(),
    minOutputAmount: z.string(),
    minOutputAmountUsd: z.number(),
    slippageTolerancePercentage: z.number(),
    gasLimit: z.string(),
    inputAmount: z.string(),
    inputAmountUsd: z.number(),
    inputToken: z.string(),
    outputToken: z.string(),
    outputAmount: z.string(),
    outputAmountUsd: z.number(),
    partner: z.string(),
    feeToken: z.string(),
    feeAmount: z.string(),
    feeAmountUsd: z.number(),
    sender: z.string(),
    recipient: z.string(),
    target: z.string(),
    value: z.string()
  }),
  tx: portalsTxSchema
})

export type TPortalsTransaction = z.infer<typeof portalsTransactionSchema>

type TGetApprovalProps = {
  params: {
    sender: TAddress
    inputToken: string
    inputAmount: string
  }
}

const portalsApprovalSchema = z.object({
  context: z.object({
    allowance: z.string(),
    approvalAmount: z.string(),
    canPermit: z.boolean(),
    network: z.string(),
    shouldApprove: z.boolean(),
    spender: addressSchema,
    target: addressSchema
  })
})

export type TPortalsApproval = z.infer<typeof portalsApprovalSchema>

export const PORTALS_NETWORK = new Map<number, string>([
  [1, 'ethereum'],
  [10, 'optimism'],
  [56, 'bsc'],
  [100, 'gnosis'],
  [137, 'polygon'],
  [250, 'fantom'],
  [8453, 'base'],
  [42161, 'arbitrum'],
  [43114, 'avalanche']
])

const BASE_URL = 'https://api.portals.fi/v2'

export async function getPortalsEstimate({
  params
}: TGetEstimateProps): TFetchReturn<TPortalsEstimate> {
  const url = `${BASE_URL}/portal/estimate`

  return fetch<TPortalsEstimate>({
    endpoint: `${url}?${new URLSearchParams(params)}`,
    schema: portalsEstimateResponseSchema
  })
}

export async function getPortalsTx({
  params
}: TGetTransactionProps): TFetchReturn<TPortalsTransaction> {
  const url = `${BASE_URL}/portal`

  return fetch<TPortalsTransaction>({
    endpoint: `${url}?${new URLSearchParams(params)}`,
    schema: portalsTransactionSchema
  })
}

export async function getPortalsApproval({
  params
}: TGetApprovalProps): TFetchReturn<TPortalsApproval> {
  const url = `${BASE_URL}/approval`

  return fetch<TPortalsApproval>({
    endpoint: `${url}?${new URLSearchParams(params)}`,
    schema: portalsApprovalSchema
  })
}
