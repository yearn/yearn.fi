import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'
import { arbitrum, base, fantom, katana, mainnet, optimism, polygon } from 'viem/chains'
import { nodeKey } from './global-model.mjs'

const directory = new URL('./', import.meta.url)
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)))
const previous = read('multichain-chain-local-pilot.json')
const fetchJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Ownership source returned ${response.status}`)
  return response.json()
}
const summary = await fetchJson('https://yearn-data-api-preview.vercel.app/api/tvl')
const graph = await fetchJson(`https://yearn-data-api-preview.vercel.app/api/tvl/graph?datasetId=${summary.datasetId}`)
assert.equal(graph.datasetId, summary.datasetId)
assert.equal(graph.asOfTimestamp, summary.asOfTimestamp)
const chains = previous.chains.map((chain) => {
  const snapshot = read(chain.artifacts.snapshot)
  const config = [mainnet, optimism, polygon, fantom, base, arbitrum, katana].find((item) => item.id === chain.chainId)
  const client = createPublicClient({
    chain: config,
    transport: http(
      (chain.chainId === 1 ? process.env.ETHEREUM_RPC_URL : null) ||
        process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chain.chainId}`] ||
        config.rpcUrls.default.http[0],
      { timeout: 45000, retryCount: 2 }
    )
  })
  return { ...chain, snapshot, client }
})
const chainLookup = new Map(chains.map((chain) => [chain.chainId, chain]))
const rows = chains.flatMap(({ chainId, name, snapshot }) =>
  snapshot.rows.map((row) => ({
    ...row,
    chainId,
    chainName: name,
    snapshotTimestamp: Number(snapshot.timestamp),
    blockNumber: snapshot.blockNumber
  }))
)
const roots = new Map(rows.map((row) => [nodeKey(row.chainId, row.address), row]))
const parseNode = (key) => ({ chainId: Number(key.split(':')[0]), address: key.split(':')[1].toLowerCase() })
const local = chains.flatMap(({ chainId }) =>
  read(`${chainId === 1 ? 'expanded-' : `chain-${chainId}-`}pilot-ledger-inputs.json`).positions.map((position) => ({
    parentChainId: chainId,
    parent: position.parent,
    childChainId: chainId,
    child: position.child,
    strategy: position.strategy,
    holder: position.strategy,
    direct: position.strategy === position.parent,
    method: position.method,
    debtStrategy:
      position.method === 'direct-strategy'
        ? position.child
        : position.method === 'strategy-held-shares'
          ? position.strategy
          : null,
    source: 'same-block queue and direct-holder scan',
    discovery: 'chain-local-scan'
  }))
)
const mapped = graph.edges.flatMap((edge) => {
  const child = parseNode(edge.targetNodeId)
  if (!roots.has(edge.targetNodeId)) return []
  const directParent = roots.get(edge.sourceNodeId)
  if (directParent) {
    const isAsset = directParent.reads.asset.toLowerCase() === child.address && directParent.chainId === child.chainId
    return [
      {
        parentChainId: directParent.chainId,
        parent: directParent.address.toLowerCase(),
        childChainId: child.chainId,
        child: child.address,
        strategy: directParent.address.toLowerCase(),
        holder: directParent.address.toLowerCase(),
        direct: true,
        method: isAsset
          ? 'vault-asset'
          : edge.valueSource === 'dated-strategy-debt'
            ? 'direct-strategy'
            : 'vault-held-shares',
        debtStrategy: edge.valueSource === 'dated-strategy-debt' ? child.address : null,
        source: 'updated DB ownership graph direct mapping',
        discovery: 'db-graph',
        graphEdgeId: edge.id
      }
    ]
  }
  const source = parseNode(edge.sourceNodeId)
  return graph.edges
    .filter(
      (incoming) =>
        incoming.targetNodeId === edge.sourceNodeId && incoming.kind === 'strategy' && roots.has(incoming.sourceNodeId)
    )
    .map((incoming) => {
      const parent = parseNode(incoming.sourceNodeId)
      assert.equal(parent.chainId, source.chainId)
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
        source: 'updated DB ownership graph strategy/remote-holder mapping',
        discovery: 'db-graph',
        graphEdgeId: edge.id
      }
    })
})
const identity = (position) =>
  `${nodeKey(position.parentChainId, position.parent)}:${position.strategy}:${nodeKey(position.childChainId, position.child)}:${position.holder}`
const descriptors = [
  ...new Map(
    [...local, ...mapped]
      .filter(
        (position) =>
          nodeKey(position.parentChainId, position.parent) !== nodeKey(position.childChainId, position.child)
      )
      .map((position) => [identity(position), position])
  ).values()
]
const balanceAbi = parseAbi(['function balanceOf(address) view returns(uint256)'])
const v3Abi = parseAbi(['function strategies(address) view returns(uint256,uint256,uint256,uint256)'])
const v2Abi = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const v230Abi = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const positions = await Promise.all(
  descriptors.map(async (position) => {
    const parent = roots.get(nodeKey(position.parentChainId, position.parent))
    const source = chainLookup.get(position.parentChainId)
    const target = chainLookup.get(position.childChainId)
    const [balance, debt] = await Promise.all([
      target.client
        .readContract({
          address: position.child,
          abi: balanceAbi,
          functionName: 'balanceOf',
          args: [position.holder],
          blockNumber: BigInt(target.snapshot.blockNumber)
        })
        .then((value) => ({ status: 'success', value: String(value) }))
        .catch((error) => ({ status: 'unavailable', error: error.name })),
      position.debtStrategy
        ? source.client
            .readContract({
              address: position.parent,
              abi: parent.version === 'v2' ? (parent.apiVersion === '0.3.0' ? v230Abi : v2Abi) : v3Abi,
              functionName: 'strategies',
              args: [position.debtStrategy],
              blockNumber: BigInt(source.snapshot.blockNumber)
            })
            .then((value) => ({
              status: 'success',
              value: String(value[parent.version === 'v2' ? (parent.apiVersion === '0.3.0' ? 5 : 6) : 2])
            }))
            .catch((error) => ({ status: 'unavailable', error: error.name }))
        : Promise.resolve({ status: 'not-required', value: null })
    ])
    return {
      ...position,
      observedSharesRaw: balance.value ?? null,
      sharesRaw: position.method === 'vault-asset' ? parent.reads.totalAssets : (balance.value ?? null),
      debtRaw: debt.value ?? null,
      balanceRead: balance.status,
      debtRead: debt.status,
      status: balance.status === 'success' && debt.status !== 'unavailable' ? 'success' : 'unavailable',
      sourceBlock: {
        chainId: position.parentChainId,
        number: source.snapshot.blockNumber,
        hash: source.snapshot.blockHash,
        timestamp: Number(source.snapshot.timestamp)
      },
      childBlock: {
        chainId: position.childChainId,
        number: target.snapshot.blockNumber,
        hash: target.snapshot.blockHash,
        timestamp: Number(target.snapshot.timestamp)
      }
    }
  })
)
const output = {
  capturedAt: new Date().toISOString(),
  asOfTimestamp: previous.asOfTimestamp,
  ownershipDatasetId: graph.datasetId,
  ownershipMappingTimestamp: graph.asOfTimestamp,
  mappingPolicy:
    'DB graph supplies identities only; all balances and recorded debts reread at pilot blocks. Direct scan supplements mappings. Root selection unchanged.',
  coverage: {
    mappedRoutes: mapped.length,
    uniqueRoutes: positions.length,
    crossChainRoutes: positions.filter((position) => position.parentChainId !== position.childChainId).length,
    unavailableRoutes: positions.filter((position) => position.status !== 'success').length,
    excludedGraphRoutes: graph.edges.filter(
      (edge) =>
        !roots.has(edge.targetNodeId) ||
        (!roots.has(edge.sourceNodeId) &&
          !graph.edges.some(
            (incoming) =>
              incoming.targetNodeId === edge.sourceNodeId &&
              incoming.kind === 'strategy' &&
              roots.has(incoming.sourceNodeId)
          ))
    ).length
  },
  positions
}
fs.writeFileSync(new URL('db-ownership-routes.json', directory), JSON.stringify(output, null, 2) + '\n')
fs.writeFileSync(new URL('db-ownership-graph.json', directory), JSON.stringify(graph, null, 2) + '\n')
fs.writeFileSync(new URL('db-ownership-summary.json', directory), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(output.coverage))
positions
  .filter((position) => position.parentChainId !== position.childChainId || position.status !== 'success')
  .forEach((position) => {
    console.log(JSON.stringify(position))
  })
