import type {
  VaultWidgetNotificationId,
  VaultWidgetNotificationStatus,
  VaultWidgetNotificationUpdate
} from '@yearn/vault-widget/runtime'
import { type Address, type Hash, isAddress } from 'viem'

export const MAX_YBOLD_WALLET_ACTIVITIES = 25

export type TYboldWalletActivity = {
  amount: string
  chainId: number
  createdAt: number
  finishedAt?: number
  fromSymbol: string
  id: VaultWidgetNotificationId
  ownerAddress: Address
  status: VaultWidgetNotificationStatus
  txHash?: Hash
  type: string
  awaitingExecution?: boolean
}

const WALLET_ACTIVITY_STATUSES = new Set<VaultWidgetNotificationStatus>(['error', 'pending', 'submitted', 'success'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWalletActivity(value: unknown): value is TYboldWalletActivity {
  if (!isRecord(value)) {
    return false
  }

  return (
    (typeof value.id === 'number' || typeof value.id === 'string') &&
    typeof value.amount === 'string' &&
    (value.awaitingExecution === undefined || typeof value.awaitingExecution === 'boolean') &&
    typeof value.chainId === 'number' &&
    typeof value.createdAt === 'number' &&
    (value.finishedAt === undefined || typeof value.finishedAt === 'number') &&
    typeof value.fromSymbol === 'string' &&
    typeof value.ownerAddress === 'string' &&
    isAddress(value.ownerAddress) &&
    typeof value.status === 'string' &&
    WALLET_ACTIVITY_STATUSES.has(value.status as VaultWidgetNotificationStatus) &&
    (value.txHash === undefined || (typeof value.txHash === 'string' && /^0x[\da-f]{64}$/i.test(value.txHash))) &&
    typeof value.type === 'string'
  )
}

export function parseYboldWalletActivities(value: string | null): TYboldWalletActivity[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter(isWalletActivity).slice(0, MAX_YBOLD_WALLET_ACTIVITIES) : []
  } catch {
    return []
  }
}

export function prependYboldWalletActivity(
  activities: readonly TYboldWalletActivity[],
  activity: TYboldWalletActivity
): TYboldWalletActivity[] {
  return [activity, ...activities.filter(({ id }) => id !== activity.id)].slice(0, MAX_YBOLD_WALLET_ACTIVITIES)
}

export function updateYboldWalletActivity(
  activities: readonly TYboldWalletActivity[],
  update: VaultWidgetNotificationUpdate,
  updatedAt: number
): TYboldWalletActivity[] {
  return activities.map((activity) => {
    if (activity.id !== update.id) {
      return activity
    }

    const status = update.status ?? activity.status
    const isFinished = status === 'success' || status === 'error'

    return {
      ...activity,
      awaitingExecution: update.awaitingExecution ?? activity.awaitingExecution,
      finishedAt: isFinished ? (activity.finishedAt ?? updatedAt) : activity.finishedAt,
      status,
      txHash: update.txHash ?? update.receipt?.transactionHash ?? activity.txHash
    }
  })
}

export function selectRecentYboldWalletActivities(
  activities: readonly TYboldWalletActivity[],
  ownerAddress: Address | undefined,
  limit = 3
): TYboldWalletActivity[] {
  if (!ownerAddress) {
    return []
  }

  const normalizedOwnerAddress = ownerAddress.toLowerCase()

  return activities
    .filter((activity) => activity.ownerAddress.toLowerCase() === normalizedOwnerAddress)
    .toSorted((left, right) => (right.finishedAt ?? right.createdAt) - (left.finishedAt ?? left.createdAt))
    .slice(0, limit)
}
