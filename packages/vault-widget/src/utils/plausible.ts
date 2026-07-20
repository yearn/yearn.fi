export const PLAUSIBLE_EVENTS = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw'
} as const

export type TPlausibleEventName = (typeof PLAUSIBLE_EVENTS)[keyof typeof PLAUSIBLE_EVENTS]
