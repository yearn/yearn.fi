import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { env } from '@/env'

export type TTranchedProductKind = 'senior' | 'junior'
export type TTranchedAsset = 'USD' | 'ETH' | 'BTC'

export type TTranchedProduct = {
  id: string
  kind: TTranchedProductKind
  asset: TTranchedAsset
  name: string
  symbol: string
  shortName: string
  intent: string
  apyLabel: string
  apyCaption: string
  tvl: string
  capacity: string
  liquidity: string
  riskPosition: string
  protection: string
  underlying: string
  primaryAction: string
  listPlacement: string
  detailLead: string
  mechanics: string[]
  scenarios: Array<{
    label: string
    vaultReturn: string
    productReturn: string
  }>
}

export type TTranchedVaultRow = {
  product: TTranchedProduct
  vault: TKongVaultView
  href: string
  logoSrc: string
}

const ZERO_ADDRESS = toAddress('0x0000000000000000000000000000000000000000')
const WETH_ADDRESS = toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
const USDC_ADDRESS = toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const WBTC_ADDRESS = toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')

const SYNTHETIC_ADDRESSES: Record<string, `0x${string}`> = {
  'yvusd-fixed': toAddress('0x0000000000000000000000000000000000000a01'),
  'yveth-fixed': toAddress('0x0000000000000000000000000000000000000a02'),
  'yvbtc-fixed': toAddress('0x0000000000000000000000000000000000000a03'),
  'yvusd-levered': toAddress('0x0000000000000000000000000000000000000b01'),
  'yveth-levered': toAddress('0x0000000000000000000000000000000000000b02'),
  'yvbtc-levered': toAddress('0x0000000000000000000000000000000000000b03')
}

const PRODUCT_TVL: Record<string, number> = {
  'yvusd-fixed': 78_700_000,
  'yveth-fixed': 25_200_000,
  'yvbtc-fixed': 20_400_000,
  'yvusd-levered': 22_500_000,
  'yveth-levered': 4_200_000,
  'yvbtc-levered': 6_500_000
}

const PRODUCT_APY: Record<string, number> = {
  'yvusd-fixed': 0.05,
  'yveth-fixed': 0.03,
  'yvbtc-fixed': 0.02,
  'yvusd-levered': 0.0913,
  'yveth-levered': 0.1335,
  'yvbtc-levered': 0.102
}

const PRODUCT_TOTAL_ASSETS: Record<string, string> = {
  'yvusd-fixed': '78700000000000',
  'yveth-fixed': '8400000000000000000000',
  'yvbtc-fixed': '210000000000',
  'yvusd-levered': '22500000000000',
  'yveth-levered': '1400000000000000000000',
  'yvbtc-levered': '67000000000'
}

const TOKEN_PRICE: Record<TTranchedAsset, number> = {
  USD: 1,
  ETH: 3_000,
  BTC: 97_000
}

const getBaseUrl = (): string => env.BASE_URL || '/'
const getAssetsBaseUrl = (): string => env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI || ''

function getTokenConfig(asset: TTranchedAsset): {
  address: `0x${string}`
  name: string
  symbol: string
  decimals: number
  category: string
  logoSrc: string
} {
  if (asset === 'USD') {
    return {
      address: USDC_ADDRESS,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      category: 'Stablecoin',
      logoSrc: `${getBaseUrl()}yvusd-128.png`
    }
  }
  if (asset === 'BTC') {
    return {
      address: WBTC_ADDRESS,
      name: 'Wrapped BTC',
      symbol: 'WBTC',
      decimals: 8,
      category: 'Volatile',
      logoSrc: `${getBaseUrl()}yvBTC-1.png`
    }
  }
  return {
    address: WETH_ADDRESS,
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    category: 'Volatile',
    logoSrc: `${getAssetsBaseUrl()}/tokens/1/${WETH_ADDRESS.toLowerCase()}/logo-128.png`
  }
}

function buildTranchedVault(product: TTranchedProduct): TTranchedVaultRow {
  const token = getTokenConfig(product.asset)
  const apy = PRODUCT_APY[product.id] ?? 0
  const tvl = PRODUCT_TVL[product.id] ?? 0
  const address = SYNTHETIC_ADDRESSES[product.id] ?? ZERO_ADDRESS
  const vault: TKongVaultView = {
    address,
    version: '3',
    type: 'Standard',
    kind: 'Multi Strategy',
    symbol: product.symbol,
    name: product.name,
    description: product.detailLead,
    category: token.category,
    decimals: 18,
    chainID: 1,
    token: {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: '',
      decimals: token.decimals
    },
    tvl: {
      tvl,
      totalAssets: BigInt(PRODUCT_TOTAL_ASSETS[product.id] ?? '0'),
      price: TOKEN_PRICE[product.asset]
    },
    apr: {
      type: product.kind === 'senior' ? 'target' : 'estimated',
      netAPR: apy,
      fees: {
        performance: 0,
        withdrawal: 0,
        management: 0
      },
      extra: {
        stakingRewardsAPR: 0,
        gammaRewardAPR: 0
      },
      points: {
        weekAgo: apy,
        monthAgo: apy,
        inception: apy
      },
      pricePerShare: {
        today: 1,
        weekAgo: null,
        monthAgo: null
      },
      forwardAPR: {
        type: product.kind === 'senior' ? 'target' : 'estimated',
        netAPR: apy,
        composite: {
          boost: 0,
          poolAPY: 0,
          boostedAPR: 0,
          baseAPR: apy,
          cvxAPR: 0,
          rewardsAPR: 0,
          v3OracleCurrentAPR: apy,
          v3OracleStratRatioAPR: apy,
          keepCRV: 0,
          keepVELO: 0,
          cvxKeepCRV: 0
        }
      }
    },
    featuringScore: product.kind === 'senior' ? 1_000 : 900,
    strategies: [
      {
        address,
        name: product.name,
        description: product.detailLead,
        netAPR: apy,
        estimatedAPY: apy,
        status: 'active'
      }
    ],
    staking: {
      address: ZERO_ADDRESS,
      available: false,
      source: '',
      rewards: []
    },
    migration: {
      available: false,
      address: ZERO_ADDRESS,
      contract: ZERO_ADDRESS
    },
    info: {
      sourceURL: '',
      riskLevel: product.kind === 'senior' ? 1 : 3,
      riskScore: [],
      riskScoreComment: '',
      uiNotice: '',
      isRetired: false,
      isBoosted: false,
      isHighlighted: product.kind === 'senior',
      isHidden: false
    }
  }

  return {
    product,
    vault,
    href: `/vaults/tranched/${product.id}`,
    logoSrc: token.logoSrc
  }
}

export const TRANCHED_PRODUCTS: TTranchedProduct[] = [
  {
    id: 'yvusd-fixed',
    kind: 'senior',
    asset: 'USD',
    name: 'yvUSD Steady Yield',
    symbol: 'yvUSD-A',
    shortName: 'USD Steady',
    intent: 'Predictable USD yield with the most remote loss position.',
    apyLabel: '5.00%',
    apyCaption: 'target APY',
    tvl: '$78.7M',
    capacity: '71% capacity',
    liquidity: 'Instant target liquidity',
    riskPosition: 'Senior: first paid, last loss',
    protection: 'Reserve-backed coupon',
    underlying: 'USDC-denominated yvUSD stack',
    primaryAction: 'Deposit steady yield',
    listPlacement: 'Steady Yield tab',
    detailLead:
      'A senior tranche for users and partners who want a simple steady-yield USD product before choosing any higher-risk exposure.',
    mechanics: [
      'Senior receives its target coupon before other public tranches.',
      'Protocol reserve can top up the senior coupon when vault returns fall short.',
      'New senior deposits would pause if the protection stack is breached.'
    ],
    scenarios: [
      { label: 'Soft year', vaultReturn: '4.0%', productReturn: '5.00%' },
      { label: 'Normal year', vaultReturn: '6.0%', productReturn: '5.00%' },
      { label: 'Great year', vaultReturn: '7.0%', productReturn: '5.00%' }
    ]
  },
  {
    id: 'yveth-fixed',
    kind: 'senior',
    asset: 'ETH',
    name: 'yvETH Steady Yield',
    symbol: 'yvETH-A',
    shortName: 'ETH Steady',
    intent: 'Steady ETH-denominated yield with reserve and junior protection beneath it.',
    apyLabel: '3.00%',
    apyCaption: 'target APY',
    tvl: '$25.2M',
    capacity: '62% capacity',
    liquidity: 'Instant target liquidity',
    riskPosition: 'Senior: first paid, last loss',
    protection: 'Reserve plus junior buffer',
    underlying: 'WETH-denominated yvETH stack',
    primaryAction: 'Deposit steady yield',
    listPlacement: 'Steady Yield tab',
    detailLead:
      'A senior ETH tranche for capital that wants ETH exposure without taking the full strategy return distribution.',
    mechanics: [
      'Senior accrues toward a 3.00% ETH-denominated target.',
      'Junior and equity absorb losses before senior is impaired.',
      'The product is positioned for earn integrations and partner distribution.'
    ],
    scenarios: [
      { label: 'Flat year', vaultReturn: '0.0%', productReturn: '3.00%' },
      { label: 'At threshold', vaultReturn: '3.0%', productReturn: '3.00%' },
      { label: 'Strong year', vaultReturn: '5.0%', productReturn: '3.00%' }
    ]
  },
  {
    id: 'yvbtc-fixed',
    kind: 'senior',
    asset: 'BTC',
    name: 'yvBTC Steady Yield',
    symbol: 'yvBTC-A',
    shortName: 'BTC Steady',
    intent: 'Steady BTC-denominated yield for users who want the senior side of the stack.',
    apyLabel: '2.00%',
    apyCaption: 'target APY',
    tvl: '$20.4M',
    capacity: '48% capacity',
    liquidity: 'Instant target liquidity',
    riskPosition: 'Senior: first paid, last loss',
    protection: 'Reserve plus junior buffer',
    underlying: 'WBTC-denominated yvBTC stack',
    primaryAction: 'Deposit steady yield',
    listPlacement: 'Steady Yield tab',
    detailLead:
      'A senior BTC tranche for predictable BTC-denominated yield, separated from higher-upside BTC strategy risk.',
    mechanics: [
      'Senior has no excess-yield participation.',
      'Yield target is paid before junior receives coupon or upside.',
      'Capacity depends on the amount of junior and reserve capital beneath it.'
    ],
    scenarios: [
      { label: 'Loss year', vaultReturn: '-3.0%', productReturn: '2.00%' },
      { label: 'Base year', vaultReturn: '2.5%', productReturn: '2.00%' },
      { label: 'Strong year', vaultReturn: '4.0%', productReturn: '2.00%' }
    ]
  },
  {
    id: 'yvusd-levered',
    kind: 'junior',
    asset: 'USD',
    name: 'yvUSD Levered',
    symbol: 'yvUSD-B',
    shortName: 'USD Levered',
    intent: 'Amplified USD yield from excess returns after senior is paid.',
    apyLabel: '9.13%',
    apyCaption: '30-day avg APY',
    tvl: '$22.5M',
    capacity: 'Open',
    liquidity: '14-day cooldown',
    riskPosition: 'Junior: second paid, second loss',
    protection: 'Upside after senior target',
    underlying: 'USDC-denominated yvUSD stack',
    primaryAction: 'Deposit levered',
    listPlacement: 'Single Asset list',
    detailLead: 'A junior public tranche for users who arrive wanting the higher-yield, risk-on side of the USD stack.',
    mechanics: [
      'Junior receives its coupon only after senior obligations are covered.',
      'Most excess yield flows to junior, creating convex upside.',
      'Junior takes losses before senior, after reserve and equity are exhausted.'
    ],
    scenarios: [
      { label: 'Soft year', vaultReturn: '4.0%', productReturn: '0.00%' },
      { label: 'Normal year', vaultReturn: '6.0%', productReturn: '16.25%' },
      { label: 'Great year', vaultReturn: '7.0%', productReturn: '25.25%' }
    ]
  },
  {
    id: 'yveth-levered',
    kind: 'junior',
    asset: 'ETH',
    name: 'yvETH Levered',
    symbol: 'yvETH-B',
    shortName: 'ETH Levered',
    intent: 'Higher-upside ETH yield with cooldown and junior loss position.',
    apyLabel: '13.35%',
    apyCaption: 'above-threshold example',
    tvl: '$4.2M',
    capacity: 'Open',
    liquidity: '14-day cooldown',
    riskPosition: 'Junior: second paid, second loss',
    protection: '90% excess-yield share',
    underlying: 'WETH-denominated yvETH stack',
    primaryAction: 'Deposit levered',
    listPlacement: 'Single Asset list',
    detailLead:
      'A junior ETH tranche for users who explicitly want risk-on ETH yield after senior steady-yield obligations are met.',
    mechanics: [
      'Junior begins earning once the underlying yvETH stack clears the target threshold.',
      'Returns scale steeply above threshold because junior is a smaller capital slice.',
      'Cooldown makes the risk and liquidity tradeoff visible before deposit.'
    ],
    scenarios: [
      { label: 'Below threshold', vaultReturn: '2.0%', productReturn: '0.00%' },
      { label: 'Above threshold', vaultReturn: '4.0%', productReturn: '13.35%' },
      { label: 'Strong year', vaultReturn: '5.0%', productReturn: '22.35%' }
    ]
  },
  {
    id: 'yvbtc-levered',
    kind: 'junior',
    asset: 'BTC',
    name: 'yvBTC Levered',
    symbol: 'yvBTC-B',
    shortName: 'BTC Levered',
    intent: 'Amplified BTC-denominated return for users willing to sit below senior.',
    apyLabel: '10.20%',
    apyCaption: 'projected APY range high',
    tvl: '$6.5M',
    capacity: 'Open',
    liquidity: '21-day cooldown',
    riskPosition: 'Junior: second paid, second loss',
    protection: 'Excess-yield participation',
    underlying: 'WBTC-denominated yvBTC stack',
    primaryAction: 'Deposit levered',
    listPlacement: 'Single Asset list',
    detailLead:
      'A junior BTC tranche that should read as a distinct high-yield BTC product, not a hidden setting under steady-yield BTC.',
    mechanics: [
      'Junior has higher upside because senior gives up excess yield.',
      'Returns can be zero when the underlying stack misses the required threshold.',
      'The product should be compared against other risk-on single asset vaults.'
    ],
    scenarios: [
      { label: 'Low return', vaultReturn: '1.0%', productReturn: '0.00%' },
      { label: 'Base case', vaultReturn: '3.0%', productReturn: '7.40%' },
      { label: 'Strong year', vaultReturn: '4.0%', productReturn: '10.20%' }
    ]
  }
]

export function getTranchedProductsByKind(kind: TTranchedProductKind): TTranchedProduct[] {
  return TRANCHED_PRODUCTS.filter((product) => product.kind === kind)
}

export function getTranchedVaultRowsByKind(kind: TTranchedProductKind): TTranchedVaultRow[] {
  return getTranchedProductsByKind(kind).map((product) => buildTranchedVault(product))
}

export function getTranchedVaultRowByAddress(address: string): TTranchedVaultRow | undefined {
  const normalizedAddress = toAddress(address)
  return TRANCHED_PRODUCTS.map((product) => buildTranchedVault(product)).find(
    (row) => row.vault.address === normalizedAddress
  )
}

export function getTranchedProductById(productId?: string): TTranchedProduct | undefined {
  return TRANCHED_PRODUCTS.find((product) => product.id === productId)
}
