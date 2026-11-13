import { parseAbi } from 'viem'
import { baseRows, clientFor, read, write } from './curation-common.mjs'

const curation = read('curation-snapshot.json')
const previous = read('db-ownership-routes.json')
const graph = read('db-ownership-graph.json')
const key = (chain, address) => `${chain}:${address.toLowerCase()}`
const rows = [...baseRows, ...curation.selected]
const roots = new Map(rows.map((row) => [key(row.chainId, row.address), row]))
const blocks = new Map([
  ...read('pre-curation-pilot.json').chains.map((chain) => [chain.chainId, chain.sourceBlock]),
  ...curation.blocks.map((block) => [block.chainId, block])
])
const clients = new Map([...blocks.keys()].map((id) => [id, clientFor(id)]))
const node = (id) => ({
  chainId: Number(id.split(':')[0]),
  address: id.split(':')[1]
})
const mappings = graph.edges.flatMap((edge) => {
  if (!roots.has(edge.targetNodeId)) return []
  const child = node(edge.targetNodeId)
  const parent = roots.get(edge.sourceNodeId)
  if (parent) {
    const asset = parent.chainId === child.chainId && parent.reads.asset.toLowerCase() === child.address
    return [
      {
        parentChainId: parent.chainId,
        parent: parent.address.toLowerCase(),
        childChainId: child.chainId,
        child: child.address,
        strategy: parent.address.toLowerCase(),
        holder: parent.address.toLowerCase(),
        direct: true,
        method: asset
          ? 'vault-asset'
          : edge.valueSource === 'dated-strategy-debt'
            ? 'direct-strategy'
            : 'vault-held-shares',
        debtStrategy: edge.valueSource === 'dated-strategy-debt' ? child.address : null,
        source: 'DB ownership graph direct mapping',
        graphEdgeId: edge.id
      }
    ]
  }
  const source = node(edge.sourceNodeId)
  return graph.edges
    .filter(
      (incoming) =>
        incoming.targetNodeId === edge.sourceNodeId && incoming.kind === 'strategy' && roots.has(incoming.sourceNodeId)
    )
    .map((incoming) => {
      const parent = node(incoming.sourceNodeId)
      return {
        parentChainId: parent.chainId,
        parent: parent.address,
        childChainId: child.chainId,
        child: child.address,
        strategy: source.address,
        holder: edge.holderAddress.toLowerCase(),
        direct: false,
        method: 'strategy-held-shares',
        debtStrategy: source.address,
        source: 'DB ownership graph adapter/strategy/remote-holder mapping',
        graphEdgeId: edge.id
      }
    })
})
const identity = (row) =>
  `${key(row.parentChainId, row.parent)}:${row.strategy}:${key(row.childChainId, row.child)}:${row.holder}`
const old = new Map(previous.positions.map((row) => [identity(row), row]))
const pending = [...new Map(mappings.map((row) => [identity(row), row])).values()].filter(
  (row) => !old.has(identity(row)) && key(row.parentChainId, row.parent) !== key(row.childChainId, row.child)
)
const abi = parseAbi([
  'function balanceOf(address) view returns(uint256)',
  'function isAdapter(address) view returns(bool)',
  'function realAssets() view returns(uint256)'
])
const v3 = parseAbi(['function strategies(address) view returns(uint256,uint256,uint256,uint256)'])
const v2 = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const v230 = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const positions = await Promise.all(
  pending.map(async (route) => {
    const parent = roots.get(key(route.parentChainId, route.parent))
    const source = blocks.get(route.parentChainId)
    const target = blocks.get(route.childChainId)
    const client = clients.get(route.parentChainId)
    const balance = await clients
      .get(route.childChainId)
      .readContract({
        address: route.child,
        abi,
        functionName: 'balanceOf',
        args: [route.holder],
        blockNumber: BigInt(target.number)
      })
      .then((value) => ({ status: 'success', value: String(value) }))
      .catch((error) => ({ status: 'unavailable', error: error.name }))
    const debt = route.debtStrategy
      ? await (async () => {
          if (parent.version === 'morpho-v2') {
            const member = await client.readContract({
              address: route.parent,
              abi,
              functionName: 'isAdapter',
              args: [route.debtStrategy],
              blockNumber: BigInt(source.number)
            })
            if (!member) throw new Error('Adapter membership not verified')
            return client.readContract({
              address: route.debtStrategy,
              abi,
              functionName: 'realAssets',
              blockNumber: BigInt(source.number)
            })
          }
          const values = await client.readContract({
            address: route.parent,
            abi: parent.version === 'v2' ? (parent.apiVersion === '0.3.0' ? v230 : v2) : v3,
            functionName: 'strategies',
            args: [route.debtStrategy],
            blockNumber: BigInt(source.number)
          })
          return values[parent.version === 'v2' ? (parent.apiVersion === '0.3.0' ? 5 : 6) : 2]
        })()
          .then((value) => ({ status: 'success', value: String(value) }))
          .catch((error) => ({ status: 'unavailable', error: error.name }))
      : { status: 'not-required', value: null }
    return {
      ...route,
      observedSharesRaw: balance.value ?? null,
      sharesRaw: route.method === 'vault-asset' ? parent.reads.totalAssets : (balance.value ?? null),
      debtRaw: debt.value ?? null,
      balanceRead: balance.status,
      debtRead: debt.status,
      status: balance.status === 'success' && debt.status !== 'unavailable' ? 'success' : 'unavailable',
      sourceBlock: { chainId: route.parentChainId, ...source },
      childBlock: { chainId: route.childChainId, ...target }
    }
  })
)
const all = [...old.values(), ...positions]
write('curation-ownership-routes.json', {
  ...previous,
  mappingPolicy:
    'Copied validated pre-curation routes plus DB graph routes to/from added Morpho roots; balances and adapter budgets reread at pilot blocks.',
  positions: all,
  coverage: {
    uniqueRoutes: all.length,
    crossChainRoutes: all.filter((route) => route.parentChainId !== route.childChainId).length,
    unavailableRoutes: all.filter((route) => route.status !== 'success').length,
    addedRoutes: positions.length
  }
})
console.log(
  JSON.stringify({
    added: positions.length,
    unavailable: positions.filter((row) => row.status !== 'success')
  })
)
