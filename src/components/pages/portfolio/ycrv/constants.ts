import { toAddress } from '@shared/utils'
import { parseAbi } from 'viem'

export const YCRV_CHAIN_ID = 1
export const YCRV_APP_URL = 'https://ycrv.yearn.fi/app/stake'

export const YCRV_TOKEN_ADDRESS = toAddress('0xFCc5c47bE19d06BF83eB04298b026F81069ff65b')
export const YCRV_BOOSTED_STAKER_ADDRESS = toAddress('0xE9A115b77A1057C918F997c32663FdcE24FB873f')
export const YCRV_REWARDS_DISTRIBUTOR_ADDRESS = toAddress('0xB226c52EB411326CdB54824a88aBaFDAAfF16D3d')
export const YCRV_BOOSTED_STAKER_UTILITIES_ADDRESS = toAddress('0x499099832153c7D3Cd88F9B8B5d6cA59FaC505c3')
export const YVCRVUSD_REWARD_ADDRESS = toAddress('0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F')

export const YCRV_BOOSTED_STAKER_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
])

export const YCRV_BOOSTED_STAKER_UTILITIES_ABI = parseAbi([
  'function getUserActiveApr(address account, uint256 stakeTokenPrice, uint256 rewardTokenPrice) view returns (uint256)',
  'function getUserActiveBoostMultiplier(address account) view returns (uint256)'
])

export const YCRV_REWARDS_DISTRIBUTOR_ABI = parseAbi([
  'function getClaimable(address account) view returns (uint256)',
  'function getSuggestedClaimRange(address account) view returns (uint256 claimStartWeek, uint256 claimEndWeek)',
  'function claimWithRange(uint256 claimStartWeek, uint256 claimEndWeek) returns (uint256 amountClaimed)'
])
