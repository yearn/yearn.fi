import { type DehydratedState, dehydrate, QueryClient } from '@tanstack/react-query'
import * as z from 'zod'
import { YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS } from '@/components/pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/components/pages/vaults/utils/yvUsd'
import { PUBLIC_VAULT_DATA_CACHE_TIME } from '@/components/shared/data/publicQueryCache'
import {
  buildVaultSnapshotEndpoint,
  YEARN_TVL_ENDPOINT,
  YEARN_VAULT_LIST_ENDPOINT
} from '@/components/shared/data/publicQueryEndpoints'
import { fetchWithSchema, getFetchQueryKey } from '@/components/shared/utils/fetchQuery'
import { kongVaultListSchema } from '@/components/shared/utils/schemas/kongVaultListSchema'
import { kongVaultSnapshotSchema } from '@/components/shared/utils/schemas/kongVaultSnapshotSchema'

const LANDING_TVL_STALE_TIME = 2 * 60 * 1000
const VAULT_LIST_STALE_TIME = PUBLIC_VAULT_DATA_CACHE_TIME
const VAULT_SNAPSHOT_STALE_TIME = PUBLIC_VAULT_DATA_CACHE_TIME
const LANDING_TVL_TIMEOUT_MS = 1500
const VAULT_LIST_TIMEOUT_MS = 3500
const VAULT_SNAPSHOT_TIMEOUT_MS = 1200

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

async function prefetchYvVaultSnapshots(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    prefetchVaultSnapshot(queryClient, YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS),
    prefetchVaultSnapshot(queryClient, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS),
    prefetchVaultSnapshot(queryClient, YVBTC_CHAIN_ID, YVBTC_UNLOCKED_ADDRESS)
  ])
}

export async function getLandingPageDehydratedState(): Promise<DehydratedState> {
  const queryClient = createSsrQueryClient()

  await prefetchPublicQuery({
    queryClient,
    endpoint: YEARN_TVL_ENDPOINT,
    schema: z.number(),
    staleTime: LANDING_TVL_STALE_TIME,
    timeoutMs: LANDING_TVL_TIMEOUT_MS
  })

  return dehydrateQueryClient(queryClient)
}

export async function getVaultsPageDehydratedState(): Promise<DehydratedState> {
  const queryClient = createSsrQueryClient()

  await Promise.all([prefetchVaultList(queryClient), prefetchYvVaultSnapshots(queryClient)])

  return dehydrateQueryClient(queryClient)
}

export async function getVaultDetailPageDehydratedState(
  chainId?: number | string,
  address?: string
): Promise<DehydratedState> {
  const queryClient = createSsrQueryClient()

  await Promise.all([
    prefetchVaultList(queryClient),
    prefetchVaultSnapshot(queryClient, chainId, address),
    prefetchYvVaultSnapshots(queryClient)
  ])

  return dehydrateQueryClient(queryClient)
}
