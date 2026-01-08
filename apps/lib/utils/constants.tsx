import type { TAddress, TNDict, TToken } from '@lib/types'
import { arbitrum, base, fantom, mainnet, optimism, polygon, sonic } from 'viem/chains'
import { toAddress } from './tools.address'
import { katana } from './wagmi'

export const SUPPORTED_NETWORKS = [mainnet, optimism, polygon, fantom, base, arbitrum, sonic, katana]

export const MULTICALL3_ADDRESS = toAddress('0xcA11bde05977b3631167028862bE2a173976CA11')

// Various tokens that are used in the app
export const ZERO_ADDRESS = toAddress('0x0000000000000000000000000000000000000000')
export const YFI_ADDRESS = toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e')
export const ETH_TOKEN_ADDRESS = toAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
export const WETH_TOKEN_ADDRESS = toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
export const WFTM_TOKEN_ADDRESS = toAddress('0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83')
export const OPT_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006')
export const BASE_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006')
export const ARB_WETH_TOKEN_ADDRESS = toAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')
export const CRV_TOKEN_ADDRESS = toAddress('0xD533a949740bb3306d119CC777fa900bA034cd52')
export const THREECRV_TOKEN_ADDRESS = toAddress('0x6c3f90f043a72fa612cbac8115ee7e52bde6e490')
export const CVXCRV_TOKEN_ADDRESS = toAddress('0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7')

export const BIG_ZERO = 0n
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

// Theses constants are used by the yCRV app
export const YVECRV_POOL_LP_ADDRESS = toAddress('0x7E46fd8a30869aa9ed55af031067Df666EfE87da')
export const ZAP_YEARN_VE_CRV_ADDRESS = toAddress('0xdc899AB992fbCFbac936CE5a5bC5A86a5d35A66a')
export const YCRV_CURVE_POOL_ADDRESS = toAddress('0x453D92C7d4263201C69aACfaf589Ed14202d83a4')
export const YCRV_CURVE_POOL_V2_ADDRESS = toAddress('0x99f5aCc8EC2Da2BC0771c32814EFF52b712de1E5')
export const VECRV_ADDRESS = toAddress('0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2')
export const VECRV_YEARN_TREASURY_ADDRESS = toAddress('0xF147b8125d2ef93FB6965Db97D6746952a133934')
export const VLYCRV_TOKEN_ADDRESS = toAddress('0xCCBD4579495cD78280e4900CB482C8Edf2EC8336')
export const YCRV_TOKEN_ADDRESS = toAddress('0xFCc5c47bE19d06BF83eB04298b026F81069ff65b')
export const STYCRV_TOKEN_ADDRESS = toAddress('0x27B5739e22ad9033bcBf192059122d163b60349D')
export const LPYCRV_TOKEN_ADDRESS = toAddress('0xc97232527B62eFb0D8ed38CF3EA103A6CcA4037e')
export const LPYCRV_V2_TOKEN_ADDRESS = toAddress('0x6E9455D109202b426169F0d8f01A3332DAE160f3')
export const YVECRV_TOKEN_ADDRESS = toAddress('0xc5bDdf9843308380375a611c18B50Fb9341f502A')
export const YVBOOST_TOKEN_ADDRESS = toAddress('0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a')
export const GAUGEYCRV_TOKEN_ADDRESS = toAddress('0x5980d25B4947594c26255C0BF301193ab64ba803')

// Theses constants are used by the yBal app
export const YBAL_VOTER_ADDRESS = toAddress('0xBA11E7024cbEB1dd2B401C70A83E0d964144686C')
export const YBAL_BALANCER_POOL_ADDRESS = toAddress('0x616D4D131F1147aC3B3C3CC752BAB8613395B2bB')
export const ZAP_YEARN_YBAL_ADDRESS = toAddress('0xCCD31df9084615d87036586F5139c83c6A058baE')
export const BAL_TOKEN_ADDRESS = toAddress('0xba100000625a3754423978a60c9317c58a424e3d')
export const YBAL_TOKEN_ADDRESS = toAddress('0x98E86Ed5b0E48734430BfBe92101156C75418cad')
export const VEBAL_TOKEN_ADDRESS = toAddress('0xC128a9954e6c874eA3d62ce62B468bA073093F25')
export const STYBAL_TOKEN_ADDRESS = toAddress('0xc09cfb625e586B117282399433257a1C0841edf3')
export const LPYBAL_TOKEN_ADDRESS = toAddress('0x640D2a6540F180aaBa2223480F445D3CD834788B')
export const GAUGEYBAL_TOKEN_ADDRESS = toAddress('0x5E23599eBE87A5A140f295C2fC6aAedb10955497')
export const BALWETH_TOKEN_ADDRESS = toAddress('0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56')
export const VEBALPEG_QUERY_HELP_CONTRACT = toAddress('0xE39B5e3B6D74016b2F6A9673D7d7493B6DF549d5')

// Theses constants are used by the yVault app
export const ZAP_ETH_WETH_CONTRACT = toAddress('0xd1791428c38e25d459d5b01fb25e942d4ad83a25')
export const ZAP_FTM_WFTM_CONTRACT = toAddress('0xfCE6CbeF3867102da383465cc237B49fF4B9d48F')
export const ZAP_ETH_WETH_OPT_CONTRACT = toAddress('0xDeAFc27aC8f977E6973d671E43cBfd2573021d9e')
export const ZAP_YVEMPIRE_CONTRACT = toAddress('0xEB8D98f9E42a15b0Eb35315F737bdfDa1a8D2Eaa')
export const VAULT_FACTORY_ADDRESS = toAddress('0x21b1FC8A52f179757bf555346130bF27c0C2A17A')
export const YVWETH_ADDRESS = toAddress('0xa258C4606Ca8206D8aA700cE2143D7db854D168c')
export const YVWFTM_ADDRESS = toAddress('0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0')
export const YVWETH_OPT_ADDRESS = toAddress('0x5B977577Eb8a480f63e11FC615D6753adB8652Ae')

// Theses constants are used by the yBribe app
export const CURVE_BRIBE_V2_ADDRESS = toAddress('0x7893bbb46613d7a4FbcC31Dab4C9b823FfeE1026')
export const CURVE_BRIBE_V3_ADDRESS = toAddress('0x03dFdBcD4056E2F92251c7B07423E1a33a7D3F6d')
export const CURVE_BRIBE_V3_HELPER_ADDRESS = toAddress('0xe298eE7278DFDa6Cd67f56c78E79f886E079b305')

// Theses constants are used by the veYFI app
export const VEYFI_ADDRESS = toAddress('0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5')
export const VEYFI_POSITION_HELPER_ADDRESS = toAddress('0x5A70cD937bA3Daec8188E937E243fFa43d6ECbe8')
export const VEYFI_OPTIONS_ADDRESS = toAddress('0x4707C855323545223fA2bA4150A83950F6F53b6E')
export const VEYFI_DYFI_ADDRESS = toAddress('0x41252E8691e964f7DE35156B68493bAb6797a275')
export const VEYFI_YFI_REWARD_POOL = toAddress('0xb287a1964AEE422911c7b8409f5E5A273c1412fA')
export const VEYFI_DYFI_REWARD_POOL = toAddress('0x2391Fc8f5E417526338F5aa3968b1851C16D894E')

// Theses constants are used in order to make the solvers work
export const SOLVER_COW_VAULT_RELAYER_ADDRESS = toAddress('0xC92E8bdf79f0507f65a392b0ab4667716BFE0110')
export const SOLVER_WIDO_RELAYER_ADDRESS = toAddress('0x7Fb69e8fb1525ceEc03783FFd8a317bafbDfD394')

// Optimism staking rewards contract addresses used on yVault app
export const STAKING_REWARDS_REGISTRY_ADDRESS = toAddress('0x8ED9F6343f057870F1DeF47AaE7CD88dfAA049A8')
export const STAKING_REWARDS_ZAP_ADDRESS = toAddress('0x498d9dCBB1708e135bdc76Ef007f08CBa4477BE2')

export const DEFAULT_SLIPPAGE = 0.5
export const DEFAULT_MAX_LOSS = 1n
export const YGAUGES_ZAP_ADDRESS = toAddress('0x1104215963474A0FA0Ac09f4E212EF7282F2A0bC') //Address of the zap to deposit & stake in the veYFI gauge
export const V3_STAKING_ZAP_ADDRESS: TNDict<TAddress> = {
  [mainnet.id]: toAddress('0x5435cA9b6D9468A6e0404a4819D39ebbF036DB1E'),
  [arbitrum.id]: toAddress('0x1E789A49902370E5858Fae67518aF49d8deA299c')
} //Address of the zap to deposit & stake for the v3 staking

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
