import { type DehydratedState, dehydrate, QueryClient } from '@tanstack/react-query'
import type * as z from 'zod'
import {
  buildVaultsInitialPayload,
  type TVaultsInitialPayload
} from '@/components/pages/vaults/utils/vaultsInitialPayload'
import {
  isYvUsdAddress,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@/components/pages/vaults/utils/yvUsd'
import { PUBLIC_VAULT_DATA_CACHE_TIME } from '@/components/shared/data/publicQueryCache'
import { buildVaultSnapshotEndpoint, YEARN_VAULT_LIST_ENDPOINT } from '@/components/shared/data/publicQueryEndpoints'
import { fetchWithSchema, getFetchQueryKey } from '@/components/shared/utils/fetchQuery'
import { kongVaultListSchema } from '@/components/shared/utils/schemas/kongVaultListSchema'
import { kongVaultSnapshotSchema } from '@/components/shared/utils/schemas/kongVaultSnapshotSchema'

const VAULT_LIST_STALE_TIME = PUBLIC_VAULT_DATA_CACHE_TIME
const VAULT_SNAPSHOT_STALE_TIME = PUBLIC_VAULT_DATA_CACHE_TIME
const VAULT_LIST_TIMEOUT_MS = 3500
const VAULT_SNAPSHOT_TIMEOUT_MS = 7000

type TPublicQueryOptions<T> = {
  queryClient: QueryClient
  endpoint: string | null
  schema: z.Schema<T>
  staleTime: number
  timeoutMs: number
}

function createSsrQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

async function prefetchPublicQuery<T>({
  queryClient,
  endpoint,
  schema,
  staleTime,
  timeoutMs
}: TPublicQueryOptions<T>): Promise<void> {
  const queryKey = getFetchQueryKey(endpoint)
  if (!endpoint || !queryKey) {
    return
  }

  try {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn: () => fetchWithSchema(endpoint, schema, { timeout: timeoutMs }),
      staleTime
    })
  } catch (error) {
    console.warn(`[SSR] Failed to prefetch ${endpoint}`, error)
  }
}

function dehydrateQueryClient(queryClient: QueryClient): DehydratedState {
  return dehydrate(queryClient)
}

function prefetchVaultList(queryClient: QueryClient): Promise<void> {
  return prefetchPublicQuery({
    queryClient,
    endpoint: YEARN_VAULT_LIST_ENDPOINT,
    schema: kongVaultListSchema,
    staleTime: VAULT_LIST_STALE_TIME,
    timeoutMs: VAULT_LIST_TIMEOUT_MS
  })
}

function prefetchVaultSnapshot(queryClient: QueryClient, chainId?: number | string, address?: string): Promise<void> {
  return prefetchPublicQuery({
    queryClient,
    endpoint: buildVaultSnapshotEndpoint(chainId, address),
    schema: kongVaultSnapshotSchema,
    staleTime: VAULT_SNAPSHOT_STALE_TIME,
    timeoutMs: VAULT_SNAPSHOT_TIMEOUT_MS
  })
}

function isMatchingSnapshotRoute(
  chainId: number | string | undefined,
  address: string | undefined,
  expectedChainId: number,
  expectedAddress: string
): boolean {
  if (!address || Number(chainId) !== expectedChainId) {
    return false
  }

  return address.toLowerCase() === expectedAddress.toLowerCase()
}

async function prefetchRelatedVaultDetailSnapshots(
  queryClient: QueryClient,
  chainId?: number | string,
  address?: string
): Promise<void> {
  if (Number(chainId) !== YVUSD_CHAIN_ID || !isYvUsdAddress(address)) {
    return
  }

  await Promise.all([
    isMatchingSnapshotRoute(chainId, address, YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)
      ? Promise.resolve()
      : prefetchVaultSnapshot(queryClient, YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS),
    isMatchingSnapshotRoute(chainId, address, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)
      ? Promise.resolve()
      : prefetchVaultSnapshot(queryClient, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)
  ])
}

export async function getVaultsPageDehydratedState(): Promise<DehydratedState> {
  const queryClient = createSsrQueryClient()

  await prefetchVaultList(queryClient)

  return dehydrateQueryClient(queryClient)
}

export async function getVaultsPageInitialPayload(): Promise<TVaultsInitialPayload | undefined> {
  try {
    const vaults = await fetchWithSchema(YEARN_VAULT_LIST_ENDPOINT, kongVaultListSchema, {
      timeout: VAULT_LIST_TIMEOUT_MS
    })
    return buildVaultsInitialPayload(vaults)
  } catch (error) {
    console.warn('[SSR] Failed to build vaults initial payload', error)
    return undefined
  }
}

export async function getVaultDetailPageDehydratedState(
  chainId?: number | string,
  address?: string
): Promise<DehydratedState> {
  const queryClient = createSsrQueryClient()

  await Promise.all([
    prefetchVaultSnapshot(queryClient, chainId, address),
    prefetchRelatedVaultDetailSnapshots(queryClient, chainId, address)
  ])

  return dehydrateQueryClient(queryClient)
}
