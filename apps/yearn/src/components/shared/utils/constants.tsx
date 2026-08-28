import type { TToken } from '@shared/types'
import { arbitrum, base, fantom, mainnet, optimism, polygon, sonic } from 'viem/chains'
import { supportedAppChains } from '@/config/supportedChains'
import { toAddress } from './tools.address'

export const SUPPORTED_NETWORKS = supportedAppChains.length
  ? supportedAppChains
  : [mainnet, optimism, polygon, fantom, base, arbitrum, sonic]

export const MULTICALL3_ADDRESS = toAddress('0xcA11bde05977b3631167028862bE2a173976CA11')

// Various tokens that are used in the app
export const ZERO_ADDRESS = toAddress('0x0000000000000000000000000000000000000000')
export const ETH_TOKEN_ADDRESS = toAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
export const WETH_TOKEN_ADDRESS = toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
export const WFTM_TOKEN_ADDRESS = toAddress('0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83')
export const OPT_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006')
export const BASE_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006')
export const ARB_WETH_TOKEN_ADDRESS = toAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')
export const MAX_UINT_256 = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn

export const DEFAULT_ERC20: TToken = {
  address: ZERO_ADDRESS,
  name: '',
  symbol: '',
  decimals: 18,
  chainID: 1,
  value: 0,
  balance: { raw: 0n, normalized: 0, display: '0', decimals: 18 }
}
export const ZAP_YEARN_VE_CRV_ADDRESS = toAddress('0xdc899AB992fbCFbac936CE5a5bC5A86a5d35A66a')

// Vault migration router (Ethereum only)
export const YEARN_4626_ROUTER = toAddress('0x1112dbCF805682e828606f74AB717abf4b4FD8DE')

// Theses constants are used by the yVault app
export const ZAP_ETH_WETH_CONTRACT = toAddress('0xd1791428c38e25d459d5b01fb25e942d4ad83a25')
export const ZAP_FTM_WFTM_CONTRACT = toAddress('0xfCE6CbeF3867102da383465cc237B49fF4B9d48F')
export const ZAP_ETH_WETH_OPT_CONTRACT = toAddress('0xDeAFc27aC8f977E6973d671E43cBfd2573021d9e')

// Merkl distributor address (same across most chains)
export const MERKLE_DISTRIBUTOR_ADDRESS = toAddress('0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae') //Address of the zap to deposit & stake for the v3 staking

/**************************************************************************************************
 ** List of vaults with disabled veYFI gauge. Hardcoded so users could still unstake/claim and
 ** exit.
 *************************************************************************************************/
export const DISABLED_VEYFI_GAUGES_VAULTS_LIST = [
  {
    address: '0x42842754aBce504E12C20E434Af8960FDf85C833',
    staking: '0xb98343536e584cf686427a54574567ba5bda8070'
  }, //GOLD-yETH,
  {
    address: '0xbA61BaA1D96c2F4E25205B331306507BcAeA4677',
    staking: '0x6130E6cD924a40b24703407F246966D7435D4998'
  }, //lp-yPRISMA
  {
    address: '0x790a60024bC3aea28385b60480f15a0771f26D09',
    staking: '0x7Fd8Af959B54A677a1D8F92265Bd0714274C56a3'
  }, // yG-yvCurve-YFIETH
  {
    address: '0xf70B3F1eA3BFc659FFb8b27E84FAE7Ef38b5bD3b',
    staking: '0x28da6dE3e804bDdF0aD237CFA6048f2930D0b4Dc'
  }, // yG-yvCurve-dYFIETH-f-f
  {
    address: '0x6E9455D109202b426169F0d8f01A3332DAE160f3',
    staking: '0x107717C98C8125A94D3d2Cc82b86a1b705f3A27C'
  }, // yG-lp-yCRVv2
  {
    address: '0x58900d761Ae3765B75DDFc235c1536B527F25d8F',
    staking: '0x81d93531720d86f0491DeE7D03f30b3b5aC24e59'
  }, // yG-yvCurve-yETH-f
  {
    address: '0x182863131F9a4630fF9E27830d945B1413e347E8',
    staking: '0xd57aEa3686d623dA2dCEbc87010a4F2F38Ac7B15'
  }, // yG-yvUSDS-1
  {
    address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    staking: '0x622fA41799406B120f9a40dA843D358b7b2CFEE3'
  }, // yG-yvUSDC-1
  {
    address: '0x028eC7330ff87667b6dfb0D94b954c820195336c',
    staking: '0x128e72DfD8b00cbF9d12cB75E846AC87B83DdFc9'
  }, // yG-yvDAI-1
  {
    address: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0',
    staking: '0x5943F7090282Eb66575662EADf7C60a717a7cE4D'
  }, // yG-yvWETH-1
  {
    address: '0x93cF0b02D0A2B61551d107378AFf60CEAe40c342',
    staking: '0xB61F8fff8Dd8C438E0d61C07b5536cE3d728f660'
  }, // yG-yvCurve-sdYFIv2-f
  {
    address: '0xFCa9Ab2996e7b010516adCC575eB63de4f4fa47A',
    staking: '0xf719B2d3925CC445D2Bb67FA12963265E224Fa11'
  }, // yG-yvCurve-upYFI-f
  {
    address: '0x6A5694C1b37fFA30690b6b60D8Cf89c937d408aD',
    staking: '0x97A597CBcA514AfCc29cD300f04F98d9DbAA3624'
  }, // yG-yvCurve-COVEYFI-f
  {
    address: '0x92545bCE636E6eE91D88D2D017182cD0bd2fC22e',
    staking: '0x38E3d865e34f7367a69f096C80A4fc329DB38BF4'
  }, // yG-yvDAI-2
  {
    address: '0xAc37729B76db6438CE62042AE1270ee574CA7571',
    staking: '0x8E2485942B399EA41f3C910c1Bb8567128f79859'
  }, // yG-yvWETH-2
  {
    address: '0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F',
    staking: '0x71c3223D6f836f84cAA7ab5a68AAb6ECe21A9f3b'
  } // yG-yvcrvUSD-2
]
