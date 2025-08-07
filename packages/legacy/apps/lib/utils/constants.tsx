import { IconAbout } from '@lib/icons/IconAbout'
import { IconFrontends } from '@lib/icons/IconFrontends'
import { IconIntegrations } from '@lib/icons/IconIntegrations'
import { IconVaults } from '@lib/icons/IconVaults'
import { IconYearn } from '@lib/icons/IconYearn'
import { IconYearnXApps } from '@lib/icons/IconYearnXApps'
import type { TAddress, TNDict, TToken } from '@lib/types'
import type { TApp } from '@lib/types/mixed'
import { arbitrum, base, fantom, mainnet, optimism, polygon, sonic } from 'viem/chains'
import { toAddress } from './tools.address'
import { katana } from './wagmi'

export const SUPPORTED_NETWORKS = [
  mainnet,
  optimism,
  polygon,
  fantom,
  base,
  arbitrum,
  sonic,
  katana
]

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
  balance: { raw: 0n, normalized: 0, display: '0' }
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
export const SOLVER_COW_VAULT_RELAYER_ADDRESS = toAddress(
  '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
)
export const SOLVER_WIDO_RELAYER_ADDRESS = toAddress('0x7Fb69e8fb1525ceEc03783FFd8a317bafbDfD394')

// Optimism staking rewards contract addresses used on yVault app
export const STAKING_REWARDS_REGISTRY_ADDRESS = toAddress(
  '0x8ED9F6343f057870F1DeF47AaE7CD88dfAA049A8'
)
export const STAKING_REWARDS_ZAP_ADDRESS = toAddress('0x498d9dCBB1708e135bdc76Ef007f08CBa4477BE2')

export const DEFAULT_SLIPPAGE = 0.5
export const DEFAULT_MAX_LOSS = 1n
export const YGAUGES_ZAP_ADDRESS = toAddress('0x1104215963474A0FA0Ac09f4E212EF7282F2A0bC') //Address of the zap to deposit & stake in the veYFI gauge
export const V3_STAKING_ZAP_ADDRESS: TNDict<TAddress> = {
  [mainnet.id]: toAddress('0x5435cA9b6D9468A6e0404a4819D39ebbF036DB1E'),
  [arbitrum.id]: toAddress('0x1E789A49902370E5858Fae67518aF49d8deA299c')
} //Address of the zap to deposit & stake for the v3 staking

export const VAULTS_APPS: TApp[] = [
  {
    name: 'V3 Vaults',
    description: 'Our newest, shiniest, and yield-iest Vaults.',
    logoURI: '/v3.png',
    appURI: '/v3'
  },
  {
    name: 'V2 Vaults',
    description: "Yearn's OG Vaults. Timeless and bursting with yield!",
    logoURI: '/v2.png',
    appURI: '/vaults'
  },
  {
    name: 'Vault Factory',
    description: 'Permissionlessly deploy Curve Vaults with the Yearn Factory.',
    logoURI: '/factory-icon.svg',
    appURI: 'https://factory.yearn.fi'
  }
]

export const YEARN_APPS: TApp[] = [
  {
    name: 'yCRV',
    description: 'Put your yCRV to work.',
    logoURI: 'https://ycrv.yearn.fi/ycrv-logo.svg',
    appURI: 'https://ycrv.yearn.fi'
  },
  {
    name: 'veYFI',
    description: 'Stake YFI to earn yield, boost gauges, and take part in governance.',
    logoURI:
      'https://token-assets-one.vercel.app/api/token/1/0x41252E8691e964f7DE35156B68493bAb6797a275/logo-128.png',
    appURI: 'https://veyfi.yearn.fi'
  },
  {
    name: 'yETH',
    description: 'A basket of LSTs in a single token.',
    logoURI: 'https://yeth.yearn.fi/favicons/favicon-96x96.png',
    appURI: 'https://yeth.yearn.fi/'
  },
  {
    name: 'Bearn',
    description: "BeraChain's Bluest Liquid Locker",
    logoURI: '/bearn-logo.png',
    appURI: 'https://bearn.sucks'
  }
]

export const YEARN_X_APPS: TApp[] = [
  {
    name: 'Curve',
    description: 'Auto-compound and boost your Curve deposits, with Yearn.',
    logoURI: 'https://curve.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://curve.yearn.space/'
  },
  {
    name: 'Velodrome',
    description: 'Auto-compound your Velodrome deposits, with Yearn.',
    logoURI: 'https://velodrome.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://velodrome.yearn.space/'
  },
  {
    name: 'Aerodrome',
    description: 'Auto-compound your Aerodrome deposits, with Yearn.',
    logoURI: 'https://aerodrome.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://aerodrome.yearn.space/'
  },
  {
    name: 'Morpho',
    description: 'Time to feel the 🦋 effect!',
    logoURI: 'https://morpho.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://morpho.yearn.space'
  },
  {
    name: 'PoolTogether',
    description: 'Get the best risk adjusted PoolTogether yields, with Yearn.',
    logoURI: 'https://pooltogether.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://pooltogether.yearn.space'
  }
]

export const POOLS_APPS: TApp[] = []

export const INTEGRATIONS_APPS: TApp[] = [
  {
    name: 'Cove',
    description: 'Earn the best yields on-chain without the hassle of managing a portfolio.',
    logoURI:
      'https://assets-global.website-files.com/651af12fcd3055636b6ac9ad/66242dbf1d6e7ff1b18336c4_Twitter%20pp%20-%20Logo%202.png',
    appURI: 'https://cove.finance/'
  },
  {
    name: '1UP',
    description: '1UP is a public good liquid locker for YFI.',
    logoURI: 'https://1up.tokyo/logo.svg',
    appURI: 'https://1up.tokyo/'
  },
  {
    name: 'StakeDAO',
    description: 'A non-custodial liquid staking platform focused on governance tokens.',
    logoURI: 'https://www.stakedao.org/logo.png',
    appURI: 'https://www.stakedao.org'
  },
  {
    name: 'Sturdy',
    description: 'Isolated lending with shared liquidity.',
    logoURI: 'https://avatars.githubusercontent.com/u/90377574?s=200&v=4',
    appURI: 'https://v2.sturdy.finance'
  },
  {
    name: 'PWN',
    description: 'PWN is a hub for peer-to-peer (P2P) loans backed by digital assets.',
    logoURI:
      'https://3238501125-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FtZYbaMzoeA7Kw4Stxzvw%2Ficon%2F89KZ4VyGSZ33cSf5QBmo%2Fpwn.svg?alt=media',
    appURI: 'https://app.pwn.xyz/'
  },
  {
    name: 'Superform',
    description: 'Superform grows your onchain wealth. Earn the best returns on your crypto.',
    logoURI: 'https://www.superform.xyz/icon.png',
    appURI: 'https://www.superform.xyz'
  },
  {
    name: 'Resupply',
    description:
      'A decentralized stablecoin protocol, leveraging the liquidity and stability of lending markets',
    logoURI: '/resupply-logo.svg',
    appURI: 'https://www.resupply.fi'
  }
]

export const FEATURED_APPS = [
  {
    name: 'Vaults',
    description: 'Our newest, shiniest, and yield-iest Vaults.',
    logoURI: '/v3-featured.jpg',
    appURI: '/v3'
  },
  {
    name: 'yCRV',
    description: "Let Yearn's veCRV position boost your CRV yield, while you chill.",
    logoURI: '/ycrv-featured.jpg',
    appURI: 'https://ycrv.yearn.fi/'
  }
]

export const OLD_APPS: TApp[] = [
  {
    name: 'Gimme',
    description: 'DeFi yields, designed for everyone.',
    logoURI: 'https://gimme.mom/favicons/favicon-96x96.png',
    appURI: 'https://gimme.mom/'
  },
  {
    name: 'Pendle',
    description: 'The best Pendle yields, with auto-rolling functionality.',
    logoURI: 'https://pendle.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://pendle.yearn.space'
  },
  {
    name: 'AJNA',
    description: 'Get the best risk adjusted Ajna yields, with Yearn.',
    logoURI: 'https://ajna.yearn.space/favicons/favicon-512x512.png',
    appURI: 'https://ajna.yearn.space'
  },
  {
    name: 'Juiced',
    description: 'Discover yields juiced with extra token rewards.',
    logoURI: '/juiced-featured.jpg',
    appURI: 'https://juiced.app/'
  },
  {
    name: 'yPrisma',
    description: 'Put your yPRISMA to work.',
    logoURI:
      'https://token-assets-one.vercel.app/api/token/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png',
    appURI: 'https://yprisma.yearn.fi'
  }
]

export const ALL_APPS = [
  ...FEATURED_APPS,
  ...VAULTS_APPS,
  ...YEARN_APPS,
  ...YEARN_X_APPS,
  ...INTEGRATIONS_APPS,
  ...OLD_APPS
]

export const CATEGORIES_DICT = {
  'featured-apps': {
    categoryName: 'Featured Products',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'featured-apps',
    apps: FEATURED_APPS
  },
  vaults: {
    categoryName: 'Yearn Vaults',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'vaults',
    apps: VAULTS_APPS
  },
  'yearn-apps': {
    categoryName: 'Other Yearn Products',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'yearn-apps',
    apps: YEARN_APPS
  },
  'yearn-x': {
    categoryName: 'Yearn X Projects',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'yearn-x',
    apps: YEARN_X_APPS
  },
  integrations: {
    categoryName: 'Integrations',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'integrations',
    apps: INTEGRATIONS_APPS
  },
  'retired-apps': {
    categoryName: 'Retired Products',
    categoryDescription:
      'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.',
    categorySlug: 'Retired Products',
    apps: OLD_APPS
  }
}

export const LANDING_SIDEBAR_LINKS = [
  { title: 'Discourse', href: 'https://gov.yearn.fi/' },
  { title: 'Docs', href: 'https://docs.yearn.fi/' },
  { title: 'Blog', href: 'https://blog.yearn.fi/' },
  { title: 'Support', href: 'https://discord.com/invite/yearn' },
  { title: 'Discord', href: 'https://discord.com/invite/yearn' },
  { title: 'Twitter', href: 'https://twitter.com/yearnfi' },
  { title: 'API', href: 'https://github.com/yearn/ydaemon' }
]

export const MENU_TABS = [
  { title: 'Home', route: 'apps' },
  { title: 'Vaults', route: 'vaults' },
  { title: 'Yearn Apps', route: 'yearn-apps' },
  { title: 'Yearn X Projects', route: 'yearn-x' },
  { title: 'Integrations', route: 'integrations' },
  { title: 'Retired Apps', route: 'retired-apps' }
  // {title: 'About', route: 'about'}
]

export const CATEGORY_PAGE_FILTERS = [
  { title: 'All', value: 'all' },
  { title: 'Filter', value: 'filter' },
  { title: 'Tab', value: 'tab' },
  { title: 'Large Filter', value: 'large-filter' }
]

export const iconsDict = {
  apps: <IconYearn />,
  about: <IconAbout />,
  vaults: <IconVaults />,
  'yearn-apps': <IconFrontends />,
  'yearn-x': <IconYearnXApps />,
  integrations: <IconIntegrations />
}

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
  } //lp-yPRISMA
]
