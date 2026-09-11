const DISABLED_BASE_ACCOUNT_MESSAGE = 'Base Account is disabled for the Yearn Reown wallet integration'

export function createBaseAccountSDK(): never {
  throw new Error(DISABLED_BASE_ACCOUNT_MESSAGE)
}
