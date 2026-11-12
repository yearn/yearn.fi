import { getChain } from '@erc4626/lib/chains'
import { DEMO_CROSS_CHAIN_ASSET, DEMO_FACTORY, DEMO_HOLDING, isDemoHolding } from '@erc4626/lib/demoHolding'
import { RPC_URLS } from '@erc4626/lib/rpc'
import { vaultAbi } from '@yearn/vault-widget/internal/contracts/abi/vaultV2.abi'
import { normalizeEnsoRouteResponse } from '@yearn/vault-widget/internal/hooks/solvers/ensoRoute'
import { getValidatedEnsoRouterAddress } from '@yearn/vault-widget/internal/utils/ensoRouters'
import type { VaultWidgetExecutionAdapter } from '@yearn/vault-widget/runtime'
import {
  type Address,
  createPublicClient,
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  erc4626Abi,
  type Hash,
  type Hex,
  http,
  isAddress,
  maxUint256,
  numberToHex,
  type PublicClient,
  type TransactionReceipt,
  zeroHash
} from 'viem'

export const DEMO_ACCOUNT: Address = '0x000000000000000000000000000000000000dEaD'
const key = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const demoAbi = [...erc4626Abi, ...vaultAbi] as const
type TDemoZap = {
  destinationChainId: number
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOut: bigint
  router: Address
  expiresAt: number
}

/** Demo-only account state. Every upstream request is read-only; signing never reaches an RPC. */
export function createDemoWallet() {
  const balances = new Map<string, bigint>()
  const allowances = new Map<string, bigint>()
  const assets = new Map<string, Address>()
  const factoryVaults = new Set<string>()
  const pending = new Map<Hash, { chainId: number; to: Address; data: Hex }>()
  const receipts = new Map<Hash, TransactionReceipt>()
  const settlements = new Map<Hash, Promise<{ receipt: TransactionReceipt }>>()
  const clients = new Map<number, PublicClient>()
  const controls = { fail: false, chainId: 1 }
  const zaps = new Map<string, TDemoZap>()
  const zapKey = (chainId: number, to: Address, data: Hex) => `${key(chainId, to)}:${data.toLowerCase()}`
  const fetchRoute: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
    const response = await fetch(input, init)
    if (url.origin !== 'https://yearn.fi' || url.pathname !== '/api/enso/route' || !response.ok) return response
    const params = url.searchParams
    const chainId = Number(params.get('chainId'))
    const destinationChainId = Number(params.get('destinationChainId') ?? chainId)
    const { route } = normalizeEnsoRouteResponse(await response.clone().json(), response.status, chainId)
    if (!route) return response
    const router = getValidatedEnsoRouterAddress({
      chainId,
      routerAddress: route.tx.to,
      routeChainId: route.tx.chainId
    })
    const tokenIn = params.get('tokenIn'),
      tokenOut = params.get('tokenOut')
    if (
      !router ||
      !tokenIn ||
      !tokenOut ||
      !isAddress(tokenIn) ||
      !isAddress(tokenOut) ||
      params.get('fromAddress')?.toLowerCase() !== DEMO_ACCOUNT.toLowerCase() ||
      route.tx.from.toLowerCase() !== DEMO_ACCOUNT.toLowerCase() ||
      (params.get('receiver') ?? DEMO_ACCOUNT).toLowerCase() !== DEMO_ACCOUNT.toLowerCase() ||
      !getChain(destinationChainId) ||
      BigInt(route.tx.value) !== 0n
    )
      return response
    const amountIn = BigInt(params.get('amountIn') ?? '0'),
      amountOut = BigInt(route.amountOut)
    if (
      (destinationChainId === chainId && tokenIn.toLowerCase() === tokenOut.toLowerCase()) ||
      amountIn <= 0n ||
      amountOut <= 0n ||
      BigInt(route.minAmountOut) < 0n ||
      BigInt(route.minAmountOut) > amountOut
    )
      return response
    zaps.set(zapKey(chainId, router, route.tx.data), {
      destinationChainId,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      router,
      expiresAt: Date.now() + 120_000
    })
    return response
  }
  const client = (chainId: number): PublicClient => {
    const existing = clients.get(chainId)
    if (existing) return existing
    const chain = getChain(chainId)
    if (!chain) throw new Error('Unsupported demo network')
    const next = createPublicClient({ transport: http(RPC_URLS[chainId as keyof typeof RPC_URLS]) })
    clients.set(chainId, next)
    return next
  }
  const read = (chainId: number, address: Address, functionName: string, args?: readonly unknown[]) =>
    client(chainId).readContract({ address, abi: erc4626Abi, functionName, args } as never) as Promise<bigint>
  const asset = async (chainId: number, address: Address) => {
    const cached = assets.get(key(chainId, address))
    if (cached) return cached
    const value = await client(chainId)
      .readContract({ address, abi: erc4626Abi, functionName: 'asset' })
      .catch(async () => {
        const token = await client(chainId).readContract({ address, abi: vaultAbi, functionName: 'token' })
        factoryVaults.add(key(chainId, address))
        return token
      })
    assets.set(key(chainId, address), value)
    return value
  }
  const balance = async (chainId: number, address: Address): Promise<bigint> => {
    const id = key(chainId, address)
    if (balances.has(id)) return balances.get(id)!
    if (id === key(DEMO_CROSS_CHAIN_ASSET.chainId, DEMO_CROSS_CHAIN_ASSET.address)) {
      const decimals = await client(chainId).readContract({ address, abi: erc20Abi, functionName: 'decimals' })
      if (!balances.has(id)) balances.set(id, 1000n * 10n ** BigInt(decimals))
      return balances.get(id)!
    }
    if (id === key(DEMO_FACTORY.chainId, DEMO_FACTORY.asset)) {
      const decimals = await client(chainId).readContract({ address, abi: erc20Abi, functionName: 'decimals' })
      if (!balances.has(id)) balances.set(id, 25n * 10n ** BigInt(decimals))
      return balances.get(id)!
    }
    if (!isDemoHolding(chainId, address)) {
      balances.set(id, 0n)
      return 0n
    }
    const underlying = await asset(chainId, address)
    const decimals = await client(chainId).readContract({
      address: underlying,
      abi: erc20Abi,
      functionName: 'decimals'
    })
    const factoryShares = async () => {
      const [pps, shareDecimals] = await Promise.all([
        client(chainId).readContract({ address, abi: vaultAbi, functionName: 'pricePerShare' }),
        client(chainId).readContract({ address, abi: erc20Abi, functionName: 'decimals' })
      ])
      if (pps <= 0n) throw new Error('Factory share value unavailable')
      const units = id === key(DEMO_FACTORY.chainId, DEMO_FACTORY.address) ? 10n : 1000n
      return (units * 10n ** BigInt(decimals) * 10n ** BigInt(shareDecimals)) / pps
    }
    const value = factoryVaults.has(key(chainId, address))
      ? await factoryShares()
      : await read(chainId, address, 'convertToShares', [1000n * 10n ** BigInt(decimals)])
    // Concurrent readers must never overwrite a balance already changed by execution.
    if (!balances.has(id)) balances.set(id, value)
    return balances.get(id)!
  }
  const decode = (data: Hex) => {
    try {
      return decodeFunctionData({ abi: demoAbi, data })
    } catch {
      return undefined
    }
  }
  const simulate = async (chainId: number, to: Address, data: Hex) => {
    const route = zaps.get(zapKey(chainId, to, data))
    if (route) {
      if (Date.now() > route.expiresAt) throw new Error('Demo quote expired. Refresh the quote.')
      if ((await balance(chainId, route.tokenIn)) < route.amountIn) throw new Error('Insufficient demo balance')
      if ((allowances.get(`${key(chainId, route.tokenIn)}:${route.router.toLowerCase()}`) ?? 0n) < route.amountIn)
        throw new Error('Approve the sample tokens first')
      return { route, call: undefined, result: route.amountOut }
    }
    const call = decode(data)
    if (!call) throw new Error('Unsupported demo transaction')
    const args = call.args as readonly unknown[]
    const amount = args[0] as bigint
    if (call.functionName === 'approve') return { call, result: 1n, route: undefined }
    if (!['deposit', 'withdraw', 'redeem'].includes(call.functionName)) throw new Error('Unsupported demo transaction')
    const recipient = args[1] as string
    if (
      recipient.toLowerCase() !== DEMO_ACCOUNT.toLowerCase() ||
      (args[2] && String(args[2]).toLowerCase() !== DEMO_ACCOUNT.toLowerCase())
    )
      throw new Error('Demo account only')
    const token = await asset(chainId, to)
    const factoryWithdraw = call.functionName === 'withdraw' && args.length === 2
    const factory = factoryVaults.has(key(chainId, to))
    const shares = await balance(chainId, to)
    const available = await balance(chainId, token)
    if (
      call.functionName === 'deposit' &&
      (allowances.get(`${key(chainId, token)}:${to.toLowerCase()}`) ?? 0n) < amount
    )
      throw new Error('Approve the sample tokens first')
    const factoryQuote = async () => {
      const [pps, decimals] = await Promise.all([
        client(chainId).readContract({ address: to, abi: vaultAbi, functionName: 'pricePerShare' }),
        client(chainId).readContract({ address: to, abi: erc20Abi, functionName: 'decimals' })
      ])
      if (pps <= 0n) throw new Error('Factory share value unavailable')
      return call.functionName === 'deposit'
        ? (amount * 10n ** BigInt(decimals)) / pps
        : (amount * pps) / 10n ** BigInt(decimals)
    }
    const result = factory
      ? await factoryQuote()
      : await read(
          chainId,
          to,
          call.functionName === 'deposit'
            ? 'previewDeposit'
            : call.functionName === 'redeem' || factoryWithdraw
              ? 'previewRedeem'
              : 'previewWithdraw',
          [amount]
        )
    if (
      amount <= 0n ||
      (call.functionName === 'deposit'
        ? amount > available
        : call.functionName === 'redeem' || factoryWithdraw
          ? amount > shares
          : result > shares)
    )
      throw new Error('Insufficient demo balance')
    return { call, result, route: undefined }
  }
  const execute: VaultWidgetExecutionAdapter['execute'] = async ({ account, request }) => {
    if (account.toLowerCase() !== DEMO_ACCOUNT.toLowerCase() || (request.value ?? 0n) !== 0n)
      throw new Error('Demo account only')
    await simulate(request.chainId, request.to, request.data)
    await pause(500)
    const hash = `0x${crypto.randomUUID().replaceAll('-', '').padStart(64, '0')}` as Hash
    pending.set(hash, { chainId: request.chainId, to: request.to, data: request.data })
    return hash
  }
  const settleReceipt: VaultWidgetExecutionAdapter['waitForReceipt'] = async ({ chainId, hash }) => {
    const previous = receipts.get(hash)
    if (previous) return { receipt: previous }
    const tx = pending.get(hash)
    if (!tx || tx.chainId !== chainId) throw new Error('Unknown demo transaction')
    await pause(800)
    const { call, result, route } = await simulate(chainId, tx.to, tx.data)
    const args = (call?.args ?? []) as readonly unknown[]
    if (!controls.fail) {
      if (route) {
        const funds = await balance(chainId, route.tokenIn),
          output = await balance(route.destinationChainId, route.tokenOut)
        const allowanceKey = `${key(chainId, route.tokenIn)}:${route.router.toLowerCase()}`
        const approved = allowances.get(allowanceKey) ?? 0n
        if (approved !== maxUint256) allowances.set(allowanceKey, approved - route.amountIn)
        balances.set(key(chainId, route.tokenIn), funds - route.amountIn)
        balances.set(key(route.destinationChainId, route.tokenOut), output + route.amountOut)
      } else if (call?.functionName === 'approve')
        allowances.set(`${key(chainId, tx.to)}:${String(args[0]).toLowerCase()}`, args[1] as bigint)
      else if (call) {
        const token = await asset(chainId, tx.to)
        const shares = await balance(chainId, tx.to)
        const funds = await balance(chainId, token)
        const amount = args[0] as bigint
        const deposit = call.functionName === 'deposit'
        const sharesInput = call.functionName === 'redeem' || (call.functionName === 'withdraw' && args.length === 2)
        if (deposit) {
          const allowanceKey = `${key(chainId, token)}:${tx.to.toLowerCase()}`
          const approved = allowances.get(allowanceKey) ?? 0n
          if (approved !== maxUint256) allowances.set(allowanceKey, approved - amount)
        }
        balances.set(key(chainId, tx.to), deposit ? shares + result : shares - (sharesInput ? amount : result))
        balances.set(key(chainId, token), deposit ? funds - amount : funds + (sharesInput ? result : amount))
      }
    }
    const receipt: TransactionReceipt = {
      transactionHash: hash,
      status: controls.fail ? 'reverted' : 'success',
      from: DEMO_ACCOUNT,
      to: tx.to,
      blockHash: zeroHash,
      blockNumber: 1n,
      contractAddress: null,
      cumulativeGasUsed: 0n,
      effectiveGasPrice: 0n,
      gasUsed: 0n,
      logs: [],
      logsBloom: `0x${'0'.repeat(512)}`,
      transactionIndex: 0,
      type: 'eip1559'
    }
    receipts.set(hash, receipt)
    return { receipt }
  }
  const waitForReceipt: VaultWidgetExecutionAdapter['waitForReceipt'] = ({ chainId, hash }) => {
    if (pending.get(hash)?.chainId !== chainId) return Promise.reject(new Error('Unknown demo transaction'))
    const existing = settlements.get(hash)
    if (existing) return existing
    const result = settleReceipt({ chainId, hash })
    settlements.set(hash, result)
    return result
  }
  const request = async (chainId: number, method: string, params: readonly unknown[] = []): Promise<unknown> => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [DEMO_ACCOUNT]
    if (method === 'eth_chainId') return numberToHex(chainId)
    if (method === 'wallet_getCapabilities') return {}
    if (method === 'eth_getBalance') return '0x0'
    if (method === 'eth_estimateGas') return numberToHex(200000n)
    if (method === 'eth_sendTransaction') {
      const tx = params[0] as { to: Address; data: Hex; from: Address; value?: Hex }
      return execute({
        account: tx.from,
        request: { chainId, to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : 0n }
      })
    }
    if (method === 'eth_getTransactionReceipt' && pending.has(params[0] as Hash)) {
      const { receipt } = await waitForReceipt({ chainId, hash: params[0] as Hash })
      return {
        ...receipt,
        blockNumber: numberToHex(receipt.blockNumber),
        cumulativeGasUsed: '0x0',
        effectiveGasPrice: '0x0',
        gasUsed: '0x0',
        status: receipt.status === 'success' ? '0x1' : '0x0',
        transactionIndex: '0x0',
        type: '0x2'
      }
    }
    if (method === 'eth_call') {
      const tx = params[0] as { to: Address; data?: Hex }
      if (tx.data && zaps.has(zapKey(chainId, tx.to, tx.data))) {
        await simulate(chainId, tx.to, tx.data)
        return '0x'
      }
      const call = tx.data ? decode(tx.data) : undefined
      const args = call?.args as readonly unknown[] | undefined
      const owner = args?.[0]
      const demoOwner = typeof owner === 'string' && owner.toLowerCase() === DEMO_ACCOUNT.toLowerCase()
      const encoded = (value: unknown) =>
        encodeFunctionResult({ abi: demoAbi, functionName: call!.functionName, result: value } as never)
      if (call?.functionName === 'balanceOf' && demoOwner) return encoded(await balance(chainId, tx.to))
      if (call?.functionName === 'allowance' && demoOwner)
        return encoded(allowances.get(`${key(chainId, tx.to)}:${String(args![1]).toLowerCase()}`) ?? 0n)
      if ((call?.functionName === 'maxWithdraw' || call?.functionName === 'maxRedeem') && demoOwner) {
        await asset(chainId, tx.to)
        const shares = await balance(chainId, tx.to)
        return encoded(
          call.functionName === 'maxRedeem' ? shares : await read(chainId, tx.to, 'previewRedeem', [shares])
        )
      }
      if (call && ['approve', 'deposit', 'withdraw', 'redeem'].includes(call.functionName)) {
        const simulated = await simulate(chainId, tx.to, tx.data!)
        return encoded(call.functionName === 'approve' ? true : simulated.result)
      }
      const response = await client(chainId).request({ method, params } as never)
      if (call?.functionName === 'asset' || call?.functionName === 'token') {
        assets.set(key(chainId, tx.to), `0x${String(response).slice(-40)}` as Address)
        if (call.functionName === 'token') factoryVaults.add(key(chainId, tx.to))
      }
      return response
    }
    // Fail closed: no signing, raw transaction, batch or unknown wallet methods can escape.
    if (
      ![
        'eth_blockNumber',
        'eth_getCode',
        'eth_getBlockByNumber',
        'eth_getTransactionCount',
        'eth_gasPrice',
        'eth_maxPriorityFeePerGas',
        'eth_feeHistory'
      ].includes(method)
    )
      throw new Error(`Unsupported demo RPC method: ${method}`)
    return client(chainId).request({ method, params } as never)
  }
  const getTokenReferences = () =>
    Array.from(
      new Map(
        [
          DEMO_CROSS_CHAIN_ASSET,
          { chainId: 1, address: DEMO_HOLDING.address },
          { chainId: 1, address: DEMO_FACTORY.address },
          { chainId: 1, address: DEMO_FACTORY.asset },
          { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address },
          ...Array.from(balances).flatMap(([id, amount]) => {
            const [chain, address] = id.split(':')
            return amount > 0n ? [{ chainId: Number(chain), address: address as Address }] : []
          })
        ].map((token) => [key(token.chainId, token.address), token])
      ).values()
    )
  return { controls, request, execution: { execute, waitForReceipt }, balance, fetchRoute, getTokenReferences }
}
