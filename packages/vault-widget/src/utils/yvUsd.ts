import { toAddress } from '@yearn/vault-widget/internal/utils'
import type { Address } from 'viem'

export const YVUSD_CHAIN_ID = 1
export const YVUSD_DECIMALS = 6
export const YVUSD_UNLOCKED_ADDRESS = toAddress('0x696d02Db93291651ED510704c9b286841d506987') as Address
export const YVUSD_LOCKED_ADDRESS = toAddress('0xAaaFEa48472f77563961Cdb53291DEDfB46F9040') as Address
export const YVUSD_LOCKED_ZAP_ADDRESS = toAddress('0x7ba61c8e19414dcB8fe769a7Be63B508C8062bbA') as Address
