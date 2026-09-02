const DISABLED_BASE_ACCOUNT_MESSAGE = 'Base Account is disabled for the yBOLD Reown AppKit canary'

export function createBaseAccountSDK(): never {
  throw new Error(DISABLED_BASE_ACCOUNT_MESSAGE)
}
