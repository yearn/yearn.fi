import type { TAddress } from '@shared/types'
import { toAddress } from '@shared/utils'
import { erc20Abi, parseAbi } from 'viem'

export const GOVERNANCE_CHAIN_ID = 1
export const GOVERNANCE_STREAM_DURATION = 14 * 24 * 60 * 60

export const YFI_ADDRESS = toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')
export const STYFI_ADDRESS = toAddress('0x42b25284E8ae427D79da78b65DFFC232aAECc016')
export const STYFIX_ADDRESS = toAddress('0x9C42461AA8422926e3AEF7B1C6e3743597149d79')
export const YVUSDC_REWARD_ADDRESS = toAddress('0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204')
export const REWARD_CLAIMER_ADDRESS = toAddress('0xA82454009E01Ae697012a73cB232d85e61B05e50')
export const LEGACY_VEYFI_ADDRESS = toAddress('0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5')
export const VEYFI_REWARD_DISTRIBUTOR_ADDRESS = toAddress('0x2548BF65916fdABB5A5673fC4225011FF29ee884')
export const LIQUID_LOCKER_REWARD_DISTRIBUTOR_ADDRESS = toAddress('0x7eFc3953Bed2fc20b9f825eBffaB1cC8B072a000')

export const STYFI_URL = 'https://styfi.yearn.fi'
export const VEYFI_URL = 'https://veyfi.yearn.fi'

export type TLiquidLockerConfig = {
  index: number
  name: string
  symbol: 'sdYFI' | 'upYFI' | 'coveYFI'
  token: TAddress
  depositor: TAddress
  scale: bigint
}

export const LIQUID_LOCKERS: TLiquidLockerConfig[] = [
  {
    index: 0,
    name: 'StakeDAO',
    symbol: 'sdYFI',
    token: toAddress('0x97983236bE88107Cc8998733Ef73D8d969c52E37'),
    depositor: toAddress('0xA16F6FC7380300525C812ea2733Ad62DDA58143B'),
    scale: 1n
  },
  {
    index: 1,
    name: '1UP',
    symbol: 'upYFI',
    token: toAddress('0xCb7DCe63aBE175cA354Dcca9cc10554D255777Ee'),
    depositor: toAddress('0x52Aa16860E0D42B6a7b6ecC15688472eb20135c9'),
    scale: 69420n
  },
  {
    index: 2,
    name: 'Cove',
    symbol: 'coveYFI',
    token: toAddress('0xFf71841EeFca78a64421db28060855036765c248'),
    depositor: toAddress('0x3d4Ced97ADb0ae3A53DA95a47fFc749aAd26BC8f'),
    scale: 1n
  }
]

export const GOVERNANCE_ERC20_ABI = erc20Abi

export const STAKED_YFI_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function streams(address account) view returns (uint256 start, uint256 total, uint256 claimed)',
  'function maxWithdraw(address owner) view returns (uint256)'
])

export const REWARD_CLAIMER_ABI = parseAbi([
  'function claim(address recipient) returns (uint256)',
  'function claim() returns (uint256)'
])

export const LEGACY_VEYFI_ABI = parseAbi(['function locked(address account) view returns (int128 amount, uint256 end)'])

export const REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function check_lock(address account) view returns (uint256, uint256)',
  'function claim(address account) returns (uint256)',
  'function last_claimed(address account) view returns (uint256)',
  'function locks(address account) view returns (uint256 amount, uint256 boost_epochs, uint256 unlock_time)',
  'function token() view returns (address)'
])

export const LIQUID_LOCKER_DEPOSITOR_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function capacity() view returns (uint256)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function streams(address account) view returns (uint256 start, uint256 total, uint256 claimed)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)'
])
