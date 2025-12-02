import type { TNormalizedBN } from '@lib/types'
import type { TNotificationType } from '@lib/types/notifications'
import type { Address } from 'viem'

/**
 * Token option for notifications - matches the structure used in legacy TActionParams
 */
export type TNotificationTokenOption = {
  label: string
  value: Address
  symbol: string
  decimals: number
  chainID: number
}

/**
 * Action parameters for notifications - simplified version of TActionParams
 * Contains only the fields needed for notification display
 */
export type TNotificationActionParams = {
  amount: TNormalizedBN
  selectedOptionFrom?: TNotificationTokenOption
  selectedOptionTo?: TNotificationTokenOption
}

/**
 * Parameters passed to TxButton to enable notification tracking
 */
export type TTxButtonNotificationParams = {
  type: TNotificationType
  actionParams: TNotificationActionParams
}
