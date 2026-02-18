type TKongVaultListItem = {
  chainId: number
  address: string
  name: string
  symbol: string | null
  origin?: string | null
  inclusion?: {
    isYearn?: boolean
    [key: string]: boolean | undefined
  } | null
  isHidden: boolean
  isRetired: boolean
  kind: string | null
  type: string | null
  category: string | null
}

type TKongVaultSnapshot = {
  address: string
  chainId: number
  name?: string
  symbol?: string
  meta?: {
    address?: string
    chainId?: number
    name?: string
    isHidden?: boolean
    isRetired?: boolean
  }
}

type TAuditRecord = {
  address: string
  chainId: number
  inListAll: boolean
  inListOriginYearn: boolean
  listAllMetadata: {
    origin: string | null
    inclusionIsYearn: boolean | null
    isHidden: boolean | null
    isRetired: boolean | null
    kind: string | null
    type: string | null
    category: string | null
  } | null
  snapshot: {
    found: boolean
    name: string | null
    symbol: string | null
    isHidden: boolean | null
    isRetired: boolean | null
  }
  likelyExclusionReason:
    | 'missing_upstream_list_item'
    | 'excluded_by_origin_filter'
    | 'excluded_by_catalog_tag_filter'
    | 'missing_snapshot'
    | 'included_in_catalog'
}

const DEFAULT_CHAIN_ID = 1
const DEFAULT_ADDRESSES = ['0x7A26C6c1628c86788526eFB81f37a2ffac243A98', '0xf91a9A1C782a1C11B627f6E576d92C7d72CDd4AF']
const KONG_REST_BASE = (process.env.KONG_REST_BASE || 'https://kong.yearn.fi/api/rest').replace(/\/$/, '')

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

function parseArgs(argv: string[]): { chainId: number; addresses: string[] } {
  let chainId = DEFAULT_CHAIN_ID
  const addresses: string[] = []

  for (let index = 0; index < argv.length; index++) {
    const current = argv[index]
    if (current === '--chain' || current === '-c') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --chain')
      }
      chainId = Number(value)
      index += 1
      continue
    }
    if (current.startsWith('--chain=')) {
      chainId = Number(current.split('=')[1])
      continue
    }
    addresses.push(current)
  }

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chain id: ${chainId}`)
  }

  return {
    chainId,
    addresses: addresses.length > 0 ? addresses : DEFAULT_ADDRESSES
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return (await response.json()) as T
}

async function tryFetchSnapshot(chainId: number, address: string): Promise<TKongVaultSnapshot | null> {
  const url = `${KONG_REST_BASE}/snapshot/${chainId}/${address}`
  const response = await fetch(url)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return (await response.json()) as TKongVaultSnapshot
}

function indexByAddress(list: TKongVaultListItem[]): Map<string, TKongVaultListItem> {
  const map = new Map<string, TKongVaultListItem>()
  for (const item of list) {
    map.set(normalizeAddress(item.address), item)
  }
  return map
}

function deriveLikelyReason(params: {
  inListAll: boolean
  inListOriginYearn: boolean
  snapshotFound: boolean
  origin: string | null
  inclusionIsYearn: boolean | null
}): TAuditRecord['likelyExclusionReason'] {
  const { inListAll, inListOriginYearn, snapshotFound, origin, inclusionIsYearn } = params

  if (!snapshotFound) {
    return 'missing_snapshot'
  }
  if (!inListAll) {
    return 'missing_upstream_list_item'
  }
  if (!inListOriginYearn && origin !== 'yearn') {
    return 'excluded_by_origin_filter'
  }
  if (origin !== 'yearn' && inclusionIsYearn !== true) {
    return 'excluded_by_catalog_tag_filter'
  }
  return 'included_in_catalog'
}

async function main(): Promise<void> {
  const { chainId, addresses } = parseArgs(process.argv.slice(2))
  const [listAll, listOriginYearn] = await Promise.all([
    fetchJson<TKongVaultListItem[]>(`${KONG_REST_BASE}/list/vaults`),
    fetchJson<TKongVaultListItem[]>(`${KONG_REST_BASE}/list/vaults?origin=yearn`)
  ])

  const listAllByAddress = indexByAddress(listAll)
  const listOriginYearnByAddress = indexByAddress(listOriginYearn)

  const results: TAuditRecord[] = []
  for (const addressInput of addresses) {
    const address = normalizeAddress(addressInput)
    const listAllItem = listAllByAddress.get(address)
    const listOriginYearnItem = listOriginYearnByAddress.get(address)
    const snapshot = await tryFetchSnapshot(chainId, address)

    const origin = listAllItem?.origin ?? null
    const inclusionIsYearn = listAllItem?.inclusion?.isYearn ?? null
    const inListAll = Boolean(listAllItem)
    const inListOriginYearn = Boolean(listOriginYearnItem)

    results.push({
      address,
      chainId,
      inListAll,
      inListOriginYearn,
      listAllMetadata: listAllItem
        ? {
            origin,
            inclusionIsYearn,
            isHidden: listAllItem.isHidden ?? null,
            isRetired: listAllItem.isRetired ?? null,
            kind: listAllItem.kind ?? null,
            type: listAllItem.type ?? null,
            category: listAllItem.category ?? null
          }
        : null,
      snapshot: {
        found: Boolean(snapshot),
        name: snapshot?.name ?? snapshot?.meta?.name ?? null,
        symbol: snapshot?.symbol ?? null,
        isHidden: snapshot?.meta?.isHidden ?? null,
        isRetired: snapshot?.meta?.isRetired ?? null
      },
      likelyExclusionReason: deriveLikelyReason({
        inListAll,
        inListOriginYearn,
        snapshotFound: Boolean(snapshot),
        origin,
        inclusionIsYearn
      })
    })
  }

  console.log(
    JSON.stringify(
      {
        chainId,
        base: KONG_REST_BASE,
        totals: {
          listAll: listAll.length,
          listOriginYearn: listOriginYearn.length
        },
        results
      },
      null,
      2
    )
  )
}

void main()
