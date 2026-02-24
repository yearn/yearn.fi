import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

export const YVUSD_CHAIN_ID = 1
export const YVUSD_UNLOCKED_ADDRESS = toAddress('0x696d02Db93291651ED510704c9b286841d506987') as Address
export const YVUSD_LOCKED_ADDRESS = toAddress('0xAaaFEa48472f77563961Cdb53291DEDfB46F9040') as Address

export const YVUSD_LOCKED_COOLDOWN_DAYS = 14
export const YVUSD_WITHDRAW_WINDOW_DAYS = 5
const configuredYvUsdAprEndpoint = import.meta.env.VITE_YVUSD_APR_SERVICE_API?.trim().replace(/\/$/, '')
export const YVUSD_APR_SERVICE_ENDPOINT = configuredYvUsdAprEndpoint?.startsWith('/')
  ? configuredYvUsdAprEndpoint
  : '/api/yvusd/aprs'

export const YVUSD_DESCRIPTION =
  'USDC-based, cross-chain allocating vault with locked and unlocked options; locked deposits earn a share of unlocked yield.'

export type TYvUsdVariant = 'locked' | 'unlocked'

export const isYvUsdAddress = (address?: string | null): boolean => {
  if (!address) return false
  const normalized = toAddress(address)
  return normalized === YVUSD_UNLOCKED_ADDRESS || normalized === YVUSD_LOCKED_ADDRESS
}

export const isYvUsdVault = (vault?: TKongVaultInput | null): boolean => {
  if (!vault) return false
  return isYvUsdAddress(vault.address)
}
