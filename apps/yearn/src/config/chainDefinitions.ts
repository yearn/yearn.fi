import { getAppChains } from '@yearn/chains'

// Compatibility export for existing callers. Chain metadata lives in @yearn/chains.
export { katana } from 'viem/chains'
export const canonicalChains = getAppChains('yearn')
export type TCanonicalChainId = (typeof canonicalChains)[number]['id']
