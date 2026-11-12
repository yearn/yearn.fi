import { DEMO_CROSS_CHAIN_ASSET, DEMO_FACTORY, DEMO_HOLDING } from '@erc4626/lib/demoHolding'
import { createDemoWallet, DEMO_ACCOUNT } from '@erc4626/lib/demoWallet'
import { vaultAbi } from '@yearn/vault-widget/internal/contracts/abi/vaultV2.abi'
import { getKnownEnsoRouterAddress } from '@yearn/vault-widget/internal/utils/ensoRouters'
import { type Address, decodeFunctionResult, encodeFunctionData, encodeFunctionResult, erc4626Abi } from 'viem'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const network = vi.hoisted(() => ({ readContract: vi.fn(), request: vi.fn() }))
vi.mock('viem', async (original) => ({
  ...(await original<typeof import('viem')>()),
  createPublicClient: () => network
}))
vi.mock('@erc4626/lib/demoHolding', async (original) => {
  const actual = await original<typeof import('@erc4626/lib/demoHolding')>()
  return {
    ...actual,
    isDemoHolding: (chainId: number, address: string) =>
      actual.isDemoHolding(chainId, address) ||
      (chainId === 1 && address.toLowerCase() === '0x4444444444444444444444444444444444444444')
  }
})
const vault = DEMO_HOLDING.address
const token: Address = '0x2222222222222222222222222222222222222222'
const unit = 10n ** 6n
const shareUnit = 10n ** 18n

beforeEach(() => {
  vi.clearAllMocks()
  network.readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args?: readonly bigint[] }) => {
      if (functionName === 'asset') return token
      if (functionName === 'decimals') return 6
      if (functionName === 'convertToShares' || functionName === 'previewDeposit') return (args![0] * 10n ** 12n) / 2n
      if (functionName === 'previewWithdraw') return (args![0] * 10n ** 12n + 1n) / 2n
      if (functionName === 'previewRedeem') return (args![0] * 2n) / 10n ** 12n
      throw new Error('Unexpected read')
    }
  )
  network.request.mockResolvedValue(encodeFunctionResult({ abi: erc4626Abi, functionName: 'asset', result: token }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each([1, 8453])(
  'settles registered zap quotes to chain %s locally and preserves balances on failure',
  async (destinationChainId) => {
    const router = getKnownEnsoRouterAddress(1)!
    const routeData = '0x12345678' as const
    const route = {
      tx: { to: router, from: DEMO_ACCOUNT, value: '0', data: routeData },
      amountOut: String(180n * unit),
      minAmountOut: String(179n * unit),
      gas: '200000',
      route: [{ action: 'swap', protocol: 'test' }]
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(route))
    )
    const demo = createDemoWallet()
    const url =
      'https://yearn.fi/api/enso/route?' +
      new URLSearchParams({
        chainId: '1',
        destinationChainId: String(destinationChainId),
        fromAddress: DEMO_ACCOUNT,
        receiver: DEMO_ACCOUNT,
        tokenIn: vault,
        tokenOut: token,
        amountIn: String(100n * shareUnit),
        slippage: '50'
      })
    await demo.fetchRoute(url)
    await expect(demo.request(1, 'eth_call', [{ to: router, data: routeData, from: DEMO_ACCOUNT }])).rejects.toThrow(
      'Approve'
    )
    const send = async (to: Address, data: `0x${string}`) => {
      const hash = await demo.execution.execute({ account: DEMO_ACCOUNT, request: { chainId: 1, to, data } })
      const [result] = await Promise.all([
        demo.execution.waitForReceipt({ chainId: 1, hash }),
        demo.execution.waitForReceipt({ chainId: 1, hash })
      ])
      return result
    }
    await send(
      vault,
      encodeFunctionData({ abi: erc4626Abi, functionName: 'approve', args: [router, 200n * shareUnit] })
    )
    expect(await demo.request(1, 'eth_call', [{ to: router, data: routeData, from: DEMO_ACCOUNT }])).toBe('0x')
    await send(router, routeData)
    expect(await demo.balance(1, vault)).toBe(400n * shareUnit)
    expect(await demo.balance(destinationChainId, token)).toBe(180n * unit)
    if (destinationChainId !== 1) expect(await demo.balance(1, token)).toBe(0n)
    demo.controls.fail = true
    expect((await send(router, routeData)).receipt.status).toBe('reverted')
    expect(await demo.balance(1, vault)).toBe(400n * shareUnit)
    expect(await demo.balance(destinationChainId, token)).toBe(180n * unit)
    await expect(send(router, '0xaabbccdd')).rejects.toThrow('Unsupported demo transaction')
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 121000)
    await expect(send(router, routeData)).rejects.toThrow('expired')
    expect(network.request).not.toHaveBeenCalled()
  },
  15000
)

it('does not register quotes for another receiver, unknown router, or unsupported destination', async () => {
  const router = getKnownEnsoRouterAddress(1)!
  const route = {
    tx: { to: router, from: DEMO_ACCOUNT, value: '0', data: '0x12345678' },
    amountOut: '100',
    minAmountOut: '99',
    gas: '200000',
    route: []
  }
  const fetcher = vi.fn(async () => Response.json(route))
  vi.stubGlobal('fetch', fetcher)
  const demo = createDemoWallet()
  const base = new URLSearchParams({
    chainId: '1',
    fromAddress: DEMO_ACCOUNT,
    tokenIn: vault,
    tokenOut: token,
    amountIn: '10'
  })
  await demo.fetchRoute('https://yearn.fi/api/enso/route?' + base + '&receiver=' + token)
  await expect(
    demo.execution.execute({ account: DEMO_ACCOUNT, request: { chainId: 1, to: router, data: '0x12345678' } })
  ).rejects.toThrow('Unsupported')
  await demo.fetchRoute('https://yearn.fi/api/enso/route?' + base + '&destinationChainId=999999')
  fetcher.mockImplementation(async () => Response.json({ ...route, tx: { ...route.tx, to: token } }))
  await demo.fetchRoute('https://yearn.fi/api/enso/route?' + base)
  await expect(
    demo.execution.execute({ account: DEMO_ACCOUNT, request: { chainId: 1, to: router, data: '0x12345678' } })
  ).rejects.toThrow('Unsupported')
  expect(network.request).not.toHaveBeenCalled()
})

it('approves and debits Base USDC on Base and credits the destination vault on Ethereum', async () => {
  const demo = createDemoWallet()
  const source = DEMO_CROSS_CHAIN_ASSET
  const router = getKnownEnsoRouterAddress(source.chainId)!
  const data = '0x11223344' as const
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        tx: { to: router, from: DEMO_ACCOUNT, value: '0', data, chainId: source.chainId },
        amountOut: String(50n * shareUnit),
        minAmountOut: String(49n * shareUnit),
        gas: '200000',
        route: []
      })
    )
  )
  expect(await demo.balance(source.chainId, source.address)).toBe(1000n * unit)
  await demo.fetchRoute(
    'https://yearn.fi/api/enso/route?' +
      new URLSearchParams({
        chainId: String(source.chainId),
        destinationChainId: '1',
        fromAddress: DEMO_ACCOUNT,
        receiver: DEMO_ACCOUNT,
        tokenIn: source.address,
        tokenOut: vault,
        amountIn: String(100n * unit)
      })
  )
  const send = async (to: Address, callData: `0x${string}`) => {
    const hash = await demo.execution.execute({
      account: DEMO_ACCOUNT,
      request: { chainId: source.chainId, to, data: callData }
    })
    return demo.execution.waitForReceipt({ chainId: source.chainId, hash })
  }
  await expect(send(router, data)).rejects.toThrow('Approve')
  await send(
    source.address,
    encodeFunctionData({ abi: erc4626Abi, functionName: 'approve', args: [router, 100n * unit] })
  )
  expect((await send(router, data)).receipt.status).toBe('success')
  expect(await demo.balance(source.chainId, source.address)).toBe(900n * unit)
  expect(await demo.balance(1, vault)).toBe(550n * shareUnit)
  expect(await demo.balance(source.chainId, vault)).toBe(0n)
  expect(await createDemoWallet().balance(source.chainId, source.address)).toBe(1000n * unit)
  expect(network.request).not.toHaveBeenCalled()
}, 15000)

it('simulates factory share withdrawals and deposits without sending transactions upstream', async () => {
  const factory: Address = '0x4444444444444444444444444444444444444444'
  const original = network.readContract.getMockImplementation()!
  network.readContract.mockImplementation(async (call) => {
    if (call.address === factory) {
      if (call.functionName === 'pricePerShare') return 2_000_000n
      if (call.functionName === 'decimals') return 18
      throw new Error('Factory has no ERC-4626 preview methods')
    }
    return original(call)
  })
  network.request.mockResolvedValue(encodeFunctionResult({ abi: vaultAbi, functionName: 'token', result: token }))
  const demo = createDemoWallet()
  await demo.request(1, 'eth_call', [
    { to: factory, data: encodeFunctionData({ abi: vaultAbi, functionName: 'token' }) }
  ])
  expect(await demo.balance(1, factory)).toBe(500n * shareUnit)
  const send = async (to: Address, data: `0x${string}`) => {
    const hash = await demo.execution.execute({ account: DEMO_ACCOUNT, request: { chainId: 1, to, data } })
    return demo.execution.waitForReceipt({ chainId: 1, hash })
  }
  await send(
    factory,
    encodeFunctionData({ abi: vaultAbi, functionName: 'withdraw', args: [100n * shareUnit, DEMO_ACCOUNT] })
  )
  expect(await demo.balance(1, token)).toBe(200n * unit)
  await send(token, encodeFunctionData({ abi: erc4626Abi, functionName: 'approve', args: [factory, 100n * unit] }))
  await send(factory, encodeFunctionData({ abi: vaultAbi, functionName: 'deposit', args: [100n * unit, DEMO_ACCOUNT] }))
  expect(await demo.balance(1, factory)).toBe(450n * shareUnit)
  expect(await demo.balance(1, token)).toBe(100n * unit)
  expect(network.request).toHaveBeenCalledTimes(1)
}, 15000)

it('seeds spendable steCRV and a factory position, updates both sides, and resets the sample balances', async () => {
  const original = network.readContract.getMockImplementation()!
  network.readContract.mockImplementation(async (call) => {
    if (call.address.toLowerCase() === DEMO_FACTORY.address.toLowerCase()) {
      if (call.functionName === 'asset') throw new Error('Not ERC-4626')
      if (call.functionName === 'token') return DEMO_FACTORY.asset
      if (call.functionName === 'pricePerShare') return 2n * 10n ** 18n
      if (call.functionName === 'decimals') return 18
    }
    if (call.address.toLowerCase() === DEMO_FACTORY.asset.toLowerCase() && call.functionName === 'decimals') return 18
    return original(call)
  })
  const demo = createDemoWallet()
  expect(await demo.balance(1, DEMO_FACTORY.asset)).toBe(25n * shareUnit)
  expect(await demo.balance(1, DEMO_FACTORY.address)).toBe(5n * shareUnit)
  const send = async (to: Address, data: `0x${string}`) => {
    const hash = await demo.execution.execute({ account: DEMO_ACCOUNT, request: { chainId: 1, to, data } })
    return demo.execution.waitForReceipt({ chainId: 1, hash })
  }
  await send(
    DEMO_FACTORY.asset,
    encodeFunctionData({ abi: erc4626Abi, functionName: 'approve', args: [DEMO_FACTORY.address, 10n * shareUnit] })
  )
  await send(
    DEMO_FACTORY.address,
    encodeFunctionData({ abi: vaultAbi, functionName: 'deposit', args: [10n * shareUnit, DEMO_ACCOUNT] })
  )
  expect(await demo.balance(1, DEMO_FACTORY.asset)).toBe(15n * shareUnit)
  expect(await demo.balance(1, DEMO_FACTORY.address)).toBe(10n * shareUnit)
  await send(
    DEMO_FACTORY.address,
    encodeFunctionData({ abi: vaultAbi, functionName: 'withdraw', args: [2n * shareUnit, DEMO_ACCOUNT] })
  )
  expect(await demo.balance(1, DEMO_FACTORY.asset)).toBe(19n * shareUnit)
  expect(await demo.balance(1, DEMO_FACTORY.address)).toBe(8n * shareUnit)
  const reset = createDemoWallet()
  expect(await reset.balance(1, DEMO_FACTORY.asset)).toBe(25n * shareUnit)
  expect(await reset.balance(1, DEMO_FACTORY.address)).toBe(5n * shareUnit)
}, 15000)

it('uses live metadata, simulates approvals and balances with differing share decimals, and settles once', async () => {
  const demo = createDemoWallet()
  const send = async (
    to: Address,
    functionName: 'approve' | 'deposit' | 'withdraw' | 'redeem',
    args: readonly unknown[]
  ) => {
    const hash = await demo.execution.execute({
      account: DEMO_ACCOUNT,
      request: { chainId: 1, to, data: encodeFunctionData({ abi: erc4626Abi, functionName, args } as never) }
    })
    await Promise.all([
      demo.execution.waitForReceipt({ chainId: 1, hash }),
      demo.execution.waitForReceipt({ chainId: 1, hash })
    ])
  }
  const assetData = encodeFunctionData({ abi: erc4626Abi, functionName: 'asset' })
  await demo.request(1, 'eth_call', [{ to: vault, data: assetData }, 'latest'])
  expect(network.request).toHaveBeenCalledWith({
    method: 'eth_call',
    params: [{ to: vault, data: assetData }, 'latest']
  })
  expect(await demo.balance(1, token)).toBe(0n)
  expect(await demo.balance(8453, vault)).toBe(0n)
  expect(await demo.balance(1, '0x1111111111111111111111111111111111111111')).toBe(0n)
  expect(await demo.request(1, 'eth_getBalance', [DEMO_ACCOUNT, 'latest'])).toBe('0x0')
  expect(await demo.balance(1, vault)).toBe(500n * shareUnit)
  await send(vault, 'withdraw', [200n * unit, DEMO_ACCOUNT, DEMO_ACCOUNT])
  expect(await demo.balance(1, token)).toBe(200n * unit)
  await send(token, 'approve', [vault, 100n * unit])
  await send(vault, 'deposit', [100n * unit, DEMO_ACCOUNT])
  expect(await demo.balance(1, token)).toBe(100n * unit)
  expect(await demo.balance(1, vault)).toBe(450n * shareUnit)
  await send(vault, 'withdraw', [50n * unit, DEMO_ACCOUNT, DEMO_ACCOUNT])
  expect(await demo.balance(1, token)).toBe(150n * unit)
  expect(await demo.balance(1, vault)).toBe(425n * shareUnit)
  await send(vault, 'redeem', [425n * shareUnit, DEMO_ACCOUNT, DEMO_ACCOUNT])
  expect(await demo.balance(1, token)).toBe(1000n * unit)
  expect(await demo.balance(1, vault)).toBe(0n)
  expect(network.request).toHaveBeenCalledTimes(1)
}, 15000)

it('keeps failed approvals local and rejects signing and broadcast methods', async () => {
  const demo = createDemoWallet()
  demo.controls.fail = true
  const hash = await demo.execution.execute({
    account: DEMO_ACCOUNT,
    request: {
      chainId: 1,
      to: token,
      data: encodeFunctionData({ abi: erc4626Abi, functionName: 'approve', args: [vault, 100n] })
    }
  })
  expect((await demo.execution.waitForReceipt({ chainId: 1, hash })).receipt.status).toBe('reverted')
  const allowance = await demo.request(1, 'eth_call', [
    { to: token, data: encodeFunctionData({ abi: erc4626Abi, functionName: 'allowance', args: [DEMO_ACCOUNT, vault] }) }
  ])
  expect(decodeFunctionResult({ abi: erc4626Abi, functionName: 'allowance', data: allowance as `0x${string}` })).toBe(
    0n
  )
  await expect(demo.request(1, 'eth_sendRawTransaction', ['0x1234'])).rejects.toThrow('Unsupported demo RPC')
  await expect(demo.request(1, 'eth_signTypedData_v4', [])).rejects.toThrow('Unsupported demo RPC')
  await expect(
    demo.execution.execute({ account: token, request: { chainId: 1, to: vault, data: '0x' } })
  ).rejects.toThrow('Demo account only')
  expect(network.request).not.toHaveBeenCalled()
  expect(network.readContract).not.toHaveBeenCalled()
})
