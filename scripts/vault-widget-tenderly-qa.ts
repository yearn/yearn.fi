import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BOLD_ADDRESS,
  createYBoldPreset,
  createYvBtcPreset,
  createYvUsdPreset,
  ENSO_ROUTER_BY_CHAIN,
  type VaultWidgetConfig,
  type VaultWidgetRequest,
  type VaultWidgetRouteAdapter,
  type VaultWidgetToken,
  type VaultWidgetTransactionRequest,
  YBOLD_POSITION_ADDRESS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@yearn/vault-widget'
import {
  createEnsoAdapter,
  createHttpEnsoQuoteProvider,
  createMigrationQuote,
  detectMigrationPermitSupport,
  readMigrationPermitTypedData,
  readVaultWidgetCooldownState,
  splitMigrationPermitSignature,
  YEARN_4626_ROUTER_ADDRESS
} from '@yearn/vault-widget/headless'
import { createEnsoRouteHandler } from '@yearn/vault-widget/server'
import { createHttpRewardDiscoveryService, createKongVaultConfigResolver } from '@yearn/vault-widget/services'
import {
  type Address,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  erc4626Abi,
  type Hash,
  http,
  isAddressEqual,
  type PublicClient,
  parseEther,
  parseUnits,
  toHex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CANONICAL_CHAIN_ID = 1
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address
// Anvil's first deterministic test key. It must never hold production funds.
const QA_SIGNER = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const QA_ACCOUNT = QA_SIGNER.address
const JUICED_DAI_VAULT = '0xe24BA27551aBE96Ca401D39761cA2319Ea14e3CB' as Address
const JUICED_REWARD_ACCOUNT = '0x719b3d3bbb9207e301ee9abf7574a4a756e0c2e3' as Address
const OPTIMISM_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address
const V2_USDC_VAULT = '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE' as Address
const V3_USDC_MIGRATION_VAULT = '0x22028E652a2e937c876F2577f8E78f692d6DAA93' as Address
const V3_USDC_STAKING_VAULT = '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204' as Address

type RpcResponse<T> = {
  error?: { message?: string }
  result?: T
}

type FlowResult = {
  coverage: 'partial-stateful' | 'plan-only' | 'stateful'
  flow: string
  note?: string
  transactions: number
}

function readEnvFile(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(resolve(process.cwd(), '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')]
      })
  )
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function getAdapter(config: VaultWidgetConfig, id: string): VaultWidgetRouteAdapter {
  const adapter = config.adapters.find((candidate) => candidate.id === id)
  invariant(adapter, `Missing ${id} adapter for ${config.id}`)
  return adapter
}

function createRequest(params: {
  amount: bigint
  chainId?: number
  config: VaultWidgetConfig
  mode: 'deposit' | 'withdraw'
  positionBalance?: bigint
  positionSourceId?: string
  redeemAll?: boolean
  selectedToken: VaultWidgetToken
}): VaultWidgetRequest {
  return {
    account: QA_ACCOUNT,
    amount: params.amount,
    chainId: params.chainId ?? CANONICAL_CHAIN_ID,
    maxLossBps: 50,
    mode: params.mode,
    positionBalance: params.positionBalance ?? 0n,
    positionSource: params.positionSourceId
      ? params.config.positionSources?.find(({ id }) => id === params.positionSourceId)
      : undefined,
    redeemAll: params.redeemAll,
    selectedToken: params.selectedToken,
    signal: new AbortController().signal,
    slippageBps: 50
  }
}

async function main(): Promise<void> {
  const environment = readEnvFile()
  const adminRpc = environment.TENDERLY_ADMIN_RPC_URI_FOR_1
  const optimismAdminRpc = environment.TENDERLY_ADMIN_RPC_URI_FOR_10
  invariant(adminRpc, 'TENDERLY_ADMIN_RPC_URI_FOR_1 is not configured')
  invariant(optimismAdminRpc, 'TENDERLY_ADMIN_RPC_URI_FOR_10 is not configured')

  let requestId = 0
  const createRpc = (url: string) =>
    async function rpcRequest<T>(method: string, params: readonly unknown[] = []): Promise<T> {
      const response = await fetch(url, {
        body: JSON.stringify({ id: ++requestId, jsonrpc: '2.0', method, params }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      })
      const payload = (await response.json()) as RpcResponse<T>
      if (!response.ok || payload.error || payload.result === undefined) {
        throw new Error(`${method}: ${payload.error?.message ?? `HTTP ${response.status}`}`)
      }
      return payload.result
    }
  const rpc = createRpc(adminRpc)
  const optimismRpc = createRpc(optimismAdminRpc)

  const publicClient = createPublicClient({ transport: http(adminRpc) }) as PublicClient
  const optimismPublicClient = createPublicClient({ transport: http(optimismAdminRpc) }) as PublicClient
  const snapshotId = await rpc<string>('evm_snapshot')
  const results: FlowResult[] = []
  let transactionCount = 0

  const send = async (
    transaction: VaultWidgetTransactionRequest,
    label = 'Transaction',
    account: Address = QA_ACCOUNT
  ): Promise<Hash> => {
    const hash = await rpc<Hash>('eth_sendTransaction', [
      {
        data: transaction.data,
        from: account,
        to: transaction.to,
        ...(transaction.value ? { value: toHex(transaction.value) } : {})
      }
    ])
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })
    if (receipt.status !== 'success') {
      let reason = 'No revert reason returned'
      try {
        await publicClient.call({
          account,
          data: transaction.data,
          to: transaction.to,
          value: transaction.value
        })
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error)
      }
      try {
        const trace = await rpc<{
          calls?: unknown[]
          error?: string
          output?: string
          revertReason?: string
        }>('debug_traceTransaction', [hash, { tracer: 'callTracer' }])
        reason += `; trace=${JSON.stringify({
          calls: trace.calls,
          error: trace.error,
          output: trace.output,
          revertReason: trace.revertReason
        })}`
      } catch {
        // Some Tenderly RPC configurations do not expose debug tracing.
      }
      throw new Error(`${label} ${hash} reverted at ${transaction.to}: ${reason}`)
    }
    transactionCount += 1
    return hash
  }

  const approve = async (token: Address, spender: Address, amount: bigint): Promise<void> => {
    await send({
      chainId: CANONICAL_CHAIN_ID,
      data: encodeFunctionData({
        abi: erc20Abi,
        args: [spender, amount],
        functionName: 'approve'
      }),
      to: token
    })
  }

  const sendOptimism = async (
    transaction: VaultWidgetTransactionRequest,
    label = 'Optimism transaction'
  ): Promise<Hash> => {
    const hash = await optimismRpc<Hash>('eth_sendTransaction', [
      {
        data: transaction.data,
        from: QA_ACCOUNT,
        to: transaction.to,
        ...(transaction.value ? { value: toHex(transaction.value) } : {})
      }
    ])
    const receipt = await optimismPublicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })
    invariant(receipt.status === 'success', `${label} ${hash} reverted at ${transaction.to}`)
    transactionCount += 1
    return hash
  }

  const approveOptimism = async (token: Address, spender: Address, amount: bigint): Promise<void> => {
    await sendOptimism(
      {
        chainId: 10,
        data: encodeFunctionData({
          abi: erc20Abi,
          args: [spender, amount],
          functionName: 'approve'
        }),
        to: token
      },
      'Approve Enso router'
    )
  }

  const balanceOf = (token: Address): Promise<bigint> =>
    publicClient.readContract({
      abi: erc20Abi,
      address: token,
      args: [QA_ACCOUNT],
      functionName: 'balanceOf'
    })

  const setTokenBalance = (token: Address, amount: bigint): Promise<unknown> =>
    rpc('tenderly_setErc20Balance', [token, QA_ACCOUNT, toHex(amount)])

  const setOptimismTokenBalance = (token: Address, amount: bigint): Promise<unknown> =>
    optimismRpc('tenderly_setErc20Balance', [token, QA_ACCOUNT, toHex(amount)])

  const runFlow = async (flow: string, execute: () => Promise<unknown>): Promise<void> => {
    const startCount = transactionCount
    const executionResult = await execute()
    const result =
      typeof executionResult === 'object' && executionResult !== null && 'coverage' in executionResult
        ? (executionResult as Pick<FlowResult, 'coverage' | 'note'>)
        : undefined
    results.push({
      coverage: result?.coverage ?? 'stateful',
      flow,
      ...(result?.note ? { note: result.note } : {}),
      transactions: transactionCount - startCount
    })
  }
  invariant(environment.ENSO_API_KEY, 'ENSO_API_KEY is not configured')
  const ensoRouteHandler = createEnsoRouteHandler({
    apiKey: environment.ENSO_API_KEY,
    policy: {
      allowedChainIds: [1, 10],
      maxSlippageBps: 100
    }
  })
  const ensoProvider = createHttpEnsoQuoteProvider({
    endpoint: 'https://yearn.test/api/enso/route',
    fetcher: (input, init) => ensoRouteHandler(new Request(input, init)),
    maxPriceImpactPercent: 1,
    requirePriceImpact: true,
    trustedRouters: {
      1: [ENSO_ROUTER_BY_CHAIN[1]!],
      10: [ENSO_ROUTER_BY_CHAIN[10]!]
    }
  })

  try {
    await rpc('tenderly_setBalance', [QA_ACCOUNT, toHex(parseEther('100'))])

    await runFlow('ERC-4626 yvUSD deposit and exact Max redeem', async () => {
      const config = createYvUsdPreset({ variant: 'unlocked' })
      const adapter = getAdapter(config, 'erc4626')
      const asset = config.depositTokens[0]!
      const amount = parseUnits('100', asset.decimals)
      await setTokenBalance(asset.address, amount)

      const depositQuote = await adapter.quote(
        createRequest({ amount, config, mode: 'deposit', selectedToken: asset }),
        publicClient
      )
      invariant(depositQuote.approval, 'yvUSD deposit approval is missing')
      await approve(asset.address, depositQuote.approval.spender, depositQuote.approval.amount)
      await send(depositQuote.transaction)

      const shares = await balanceOf(config.positionToken.address)
      invariant(shares > 0n, 'yvUSD deposit produced no shares')
      const assetValue = await config.readPositionValue!(publicClient, shares)
      const withdrawQuote = await adapter.quote(
        createRequest({
          amount: assetValue,
          config,
          mode: 'withdraw',
          positionBalance: shares,
          redeemAll: true,
          selectedToken: asset
        }),
        publicClient
      )
      await send(withdrawQuote.transaction)
      invariant((await balanceOf(YVUSD_UNLOCKED_ADDRESS)) === 0n, 'yvUSD exact Max left share dust')
    })

    const lockedYvUsdSnapshotId = await rpc<string>('evm_snapshot')
    try {
      await runFlow('Locked yvUSD cooldown and nested exact Max redeem', async () => {
        const config = createYvUsdPreset({ variant: 'locked' })
        const adapter = getAdapter(config, 'yvUSD-locked')
        const asset = config.depositTokens[0]!
        const amount = parseUnits('100', asset.decimals)
        await setTokenBalance(asset.address, amount)

        const depositQuote = await adapter.quote(
          createRequest({ amount, config, mode: 'deposit', selectedToken: asset }),
          publicClient
        )
        invariant(depositQuote.approval, 'Locked yvUSD deposit approval is missing')
        await approve(asset.address, depositQuote.approval.spender, depositQuote.approval.amount)
        await send(depositQuote.transaction)

        const shares = await balanceOf(YVUSD_LOCKED_ADDRESS)
        invariant(shares > 0n, 'Locked yvUSD deposit produced no shares')
        const assetValue = await config.readPositionValue!(publicClient, shares)
        const cooldownQuote = await adapter.quote(
          createRequest({
            amount: assetValue,
            config,
            mode: 'withdraw',
            positionBalance: shares,
            redeemAll: true,
            selectedToken: asset
          }),
          publicClient
        )
        invariant(cooldownQuote.adapterId === 'yvUSD-cooldown', 'Locked yvUSD did not request cooldown')
        await send(cooldownQuote.transaction)

        const cooldown = await readVaultWidgetCooldownState({
          account: QA_ACCOUNT,
          publicClient,
          vaultAddress: YVUSD_LOCKED_ADDRESS
        })
        invariant(cooldown.shares === shares, 'Cooldown did not preserve the exact locked share balance')
        await rpc('evm_increaseTime', [toHex(cooldown.cooldownDuration + 1)])
        await rpc('evm_mine')
        const readyCooldown = await readVaultWidgetCooldownState({
          account: QA_ACCOUNT,
          publicClient,
          vaultAddress: YVUSD_LOCKED_ADDRESS
        })
        invariant(readyCooldown.state === 'ready', `Locked yvUSD cooldown remained ${readyCooldown.state}`)

        const withdrawQuote = await adapter.quote(
          createRequest({
            amount: assetValue,
            config,
            mode: 'withdraw',
            positionBalance: shares,
            redeemAll: true,
            selectedToken: asset
          }),
          publicClient
        )
        invariant(
          withdrawQuote.transactions?.length === 2,
          `Locked yvUSD nested withdrawal is incomplete (${JSON.stringify({
            actionLabel: withdrawQuote.actionLabel,
            adapterId: withdrawQuote.adapterId,
            availableWithdrawLimit: readyCooldown.availableWithdrawLimit.toString(),
            cooldownShares: readyCooldown.shares.toString(),
            maxRedeem: readyCooldown.maxRedeem.toString(),
            notice: withdrawQuote.notice,
            positionShares: shares.toString(),
            state: readyCooldown.state
          })})`
        )
        for (const step of withdrawQuote.transactions) await send(step.transaction)
        const remainingLockedShares = await balanceOf(YVUSD_LOCKED_ADDRESS)
        invariant(
          remainingLockedShares <= shares - readyCooldown.maxRedeem,
          'Locked yvUSD protocol-executable Max left unexpected share dust'
        )
      })
    } finally {
      await rpc('evm_revert', [lockedYvUsdSnapshotId])
    }

    await runFlow('yvBTC deposit and exact Max redeem', async () => {
      const config = createYvBtcPreset()
      const adapter = getAdapter(config, 'erc4626')
      const asset = config.depositTokens[0]!
      const amount = parseUnits('0.01', asset.decimals)
      const [vaultAsset, maxDeposit] = await Promise.all([
        publicClient.readContract({
          abi: erc4626Abi,
          address: config.vaultAddress,
          functionName: 'asset'
        }),
        publicClient.readContract({
          abi: erc4626Abi,
          address: config.vaultAddress,
          args: [QA_ACCOUNT],
          functionName: 'maxDeposit'
        })
      ])
      invariant(isAddressEqual(vaultAsset, asset.address), 'yvBTC preset asset does not match the vault asset')
      await setTokenBalance(asset.address, amount)

      const depositQuote = await adapter.quote(
        createRequest({ amount, config, mode: 'deposit', selectedToken: asset }),
        publicClient
      )
      invariant(depositQuote.approval, 'yvBTC deposit approval is missing')
      if (maxDeposit === 0n) {
        invariant(
          isAddressEqual(depositQuote.approval.token.address, vaultAsset),
          'yvBTC approval uses the wrong asset'
        )
        invariant(
          isAddressEqual(depositQuote.transaction.to, config.vaultAddress),
          'yvBTC deposit targets the wrong vault'
        )
        return {
          coverage: 'plan-only',
          note: 'The live yvBTC vault reports maxDeposit=0 on this VNet snapshot.'
        }
      }
      await approve(asset.address, depositQuote.approval.spender, depositQuote.approval.amount)
      await send(depositQuote.transaction)

      const shares = await balanceOf(config.positionToken.address)
      invariant(shares > 0n, 'yvBTC deposit produced no shares')
      const assetValue = await config.readPositionValue!(publicClient, shares)
      const withdrawQuote = await adapter.quote(
        createRequest({
          amount: assetValue,
          config,
          mode: 'withdraw',
          positionBalance: shares,
          redeemAll: true,
          selectedToken: asset
        }),
        publicClient
      )
      await send(withdrawQuote.transaction)
      invariant((await balanceOf(config.positionToken.address)) === 0n, 'yvBTC exact Max left share dust')
      return undefined
    })

    await runFlow('yBOLD zap deposit and exact Max zap out', async () => {
      const config = createYBoldPreset()
      const adapter = getAdapter(config, 'ybold-zapper')
      const asset = config.depositTokens.find(({ address }) => isAddressEqual(address, BOLD_ADDRESS))!
      const amount = parseUnits('100', asset.decimals)
      await setTokenBalance(asset.address, amount)

      const depositQuote = await adapter.quote(
        createRequest({ amount, config, mode: 'deposit', selectedToken: asset }),
        publicClient
      )
      invariant(depositQuote.approval, 'yBOLD deposit approval is missing')
      await approve(asset.address, depositQuote.approval.spender, depositQuote.approval.amount)
      await send(depositQuote.transaction)

      const shares = await balanceOf(YBOLD_POSITION_ADDRESS)
      invariant(shares > 0n, 'yBOLD zap deposit produced no staked shares')
      const assetValue = await config.readPositionValue!(publicClient, shares)
      const withdrawQuote = await adapter.quote(
        createRequest({
          amount: assetValue,
          config,
          mode: 'withdraw',
          positionBalance: shares,
          redeemAll: true,
          selectedToken: asset
        }),
        publicClient
      )
      invariant(withdrawQuote.approval, 'yBOLD withdrawal approval is missing')
      await approve(YBOLD_POSITION_ADDRESS, withdrawQuote.approval.spender, withdrawQuote.approval.amount)
      await send(withdrawQuote.transaction)
      invariant((await balanceOf(YBOLD_POSITION_ADDRESS)) === 0n, 'yBOLD exact Max left share dust')
    })

    await runFlow('V3 deposit, stake, exact Max unstake, and redeem', async () => {
      const config = await createKongVaultConfigResolver().resolve(CANONICAL_CHAIN_ID, V3_USDC_STAKING_VAULT)
      const adapter = getAdapter(config, 'deposit-and-stake')
      const withdrawAdapter = getAdapter(config, 'unstake-and-withdraw')
      const asset = config.depositTokens[0]!
      const amount = parseUnits('100', asset.decimals)
      await setTokenBalance(asset.address, amount)

      const depositQuote = await adapter.quote(
        { ...createRequest({ amount, config, mode: 'deposit', selectedToken: asset }), autoStake: true },
        publicClient
      )
      for (const approval of depositQuote.approvals ?? []) {
        await approve(approval.token.address, approval.spender, approval.amount)
      }
      for (const step of depositQuote.transactions ?? []) {
        try {
          await send(step.transaction, step.label)
        } catch (error) {
          const [vaultShareBalance, stakingAllowance] = await Promise.all([
            balanceOf(config.positionToken.address),
            publicClient.readContract({
              abi: erc20Abi,
              address: config.positionToken.address,
              args: [QA_ACCOUNT, step.transaction.to],
              functionName: 'allowance'
            })
          ])
          if (
            step.label === 'Stake' &&
            vaultShareBalance === depositQuote.expectedOut &&
            stakingAllowance >= depositQuote.expectedOut
          ) {
            return {
              coverage: 'partial-stateful',
              note: 'Deposit executed, but the stale VNet gauge reward-recipient callback reverts during stake.'
            }
          }
          throw new Error(
            `${error instanceof Error ? error.message : String(error)} (expected shares ${depositQuote.expectedOut}, balance ${vaultShareBalance}, allowance ${stakingAllowance})`
          )
        }
      }

      const stakedSource = config.positionSources?.find(({ id }) => id === 'staked')
      invariant(stakedSource, 'V3 staking position source is missing')
      const stakedShares = await balanceOf(stakedSource.token.address)
      invariant(stakedShares > 0n, 'V3 staking flow produced no staked shares')
      const assetValue = await stakedSource.readValue!(publicClient, stakedShares)
      const withdrawQuote = await withdrawAdapter.quote(
        createRequest({
          amount: assetValue,
          config,
          mode: 'withdraw',
          positionBalance: stakedShares,
          positionSourceId: 'staked',
          redeemAll: true,
          selectedToken: asset
        }),
        publicClient
      )
      for (const step of withdrawQuote.transactions ?? []) await send(step.transaction, step.label)
      invariant((await balanceOf(stakedSource.token.address)) === 0n, 'V3 exact Max left staked share dust')
      invariant((await balanceOf(config.positionToken.address)) === 0n, 'V3 exact Max left vault share dust')
      return undefined
    })

    await runFlow('V2 approval migration to V3', async () => {
      const resolver = createKongVaultConfigResolver()
      const sourceConfig = await resolver.resolve(CANONICAL_CHAIN_ID, V2_USDC_VAULT)
      invariant(sourceConfig.migration, 'V2 USDC migration metadata is missing')
      const targetConfig = await resolver.resolve(CANONICAL_CHAIN_ID, sourceConfig.migration.targetVault)
      const shares = parseUnits('1', sourceConfig.positionToken.decimals)
      await setTokenBalance(sourceConfig.positionToken.address, shares)

      const quote = createMigrationQuote({
        account: QA_ACCOUNT,
        chainId: CANONICAL_CHAIN_ID,
        fromToken: sourceConfig.positionToken,
        migratorAddress: sourceConfig.migration.migratorAddress,
        shares,
        sourceVersion: sourceConfig.migration.sourceVersion,
        toVault: sourceConfig.migration.targetVault
      })
      invariant(quote.approval, 'V2 migration approval is missing')
      await approve(quote.approval.token.address, quote.approval.spender, quote.approval.amount)
      await send(quote.transaction)
      invariant((await balanceOf(sourceConfig.positionToken.address)) === 0n, 'V2 migration left source shares')
      invariant((await balanceOf(targetConfig.positionToken.address)) > 0n, 'V2 migration produced no target shares')
    })

    await runFlow('V3 EIP-2612 permit migration', async () => {
      const resolver = createKongVaultConfigResolver()
      const sourceConfig = await resolver.resolve(CANONICAL_CHAIN_ID, V3_USDC_MIGRATION_VAULT)
      invariant(sourceConfig.migration, 'V3 USDC migration metadata is missing')
      const permitSupported = await detectMigrationPermitSupport(publicClient, sourceConfig.positionToken.address)
      invariant(permitSupported, 'V3 USDC migration source does not expose EIP-2612 permit')

      const shares = parseUnits('1', sourceConfig.positionToken.decimals)
      await setTokenBalance(sourceConfig.positionToken.address, shares)
      const targetBalanceBefore = await balanceOf(sourceConfig.migration.targetVault)
      const block = await publicClient.getBlock()
      const deadline = block.timestamp + 3_600n
      const typedData = await readMigrationPermitTypedData({
        account: QA_ACCOUNT,
        chainId: await publicClient.getChainId(),
        deadline,
        publicClient,
        spender: YEARN_4626_ROUTER_ADDRESS,
        tokenAddress: sourceConfig.positionToken.address,
        value: shares
      })
      const signature = await QA_SIGNER.signTypedData(typedData)
      const quote = createMigrationQuote({
        account: QA_ACCOUNT,
        chainId: CANONICAL_CHAIN_ID,
        currentTimestamp: block.timestamp,
        fromToken: sourceConfig.positionToken,
        migratorAddress: sourceConfig.migration.migratorAddress,
        permit: splitMigrationPermitSignature(signature, {
          chainId: CANONICAL_CHAIN_ID,
          deadline,
          owner: QA_ACCOUNT,
          spender: YEARN_4626_ROUTER_ADDRESS,
          token: sourceConfig.positionToken.address,
          value: shares
        }),
        shares,
        sourceVersion: sourceConfig.migration.sourceVersion,
        toVault: sourceConfig.migration.targetVault
      })

      invariant(quote.adapterId === 'migration-permit', 'V3 migration did not select the permit route')
      invariant(!quote.approval, 'V3 permit migration unexpectedly requested an approval')
      await send(quote.transaction)
      invariant((await balanceOf(sourceConfig.positionToken.address)) === 0n, 'V3 permit migration left source shares')
      invariant(
        (await balanceOf(sourceConfig.migration.targetVault)) > targetBalanceBefore,
        'V3 permit migration produced no target shares'
      )
    })

    const juicedRewardsSnapshotId = await rpc<string>('evm_snapshot')
    try {
      await runFlow('Juiced staking reward discovery and claim', async () => {
        const config = await createKongVaultConfigResolver().resolve(CANONICAL_CHAIN_ID, JUICED_DAI_VAULT)
        const adapter = getAdapter(config, 'deposit-and-stake')
        const asset = config.depositTokens[0]!
        const amount = parseUnits('100', asset.decimals)
        await setTokenBalance(asset.address, amount)

        const depositQuote = await adapter.quote(
          { ...createRequest({ amount, config, mode: 'deposit', selectedToken: asset }), autoStake: true },
          publicClient
        )
        for (const approval of depositQuote.approvals ?? []) {
          await approve(approval.token.address, approval.spender, approval.amount)
        }
        for (const step of depositQuote.transactions ?? []) await send(step.transaction, step.label)

        await rpc('evm_increaseTime', [toHex(7 * 86_400)])
        await rpc('evm_mine')
        const rewards = await createHttpRewardDiscoveryService().discover({
          account: QA_ACCOUNT,
          config,
          publicClient
        })
        const reward = rewards.find(({ kind }) => kind === 'staking')
        if (!reward) {
          return {
            coverage: 'partial-stateful',
            note: 'Deposit and stake executed, but this VNet snapshot accrued no Juiced rewards.'
          }
        }

        const balanceBefore = await balanceOf(reward.token.address)
        await send(reward.quote.transaction, 'Claim rewards')
        invariant((await balanceOf(reward.token.address)) > balanceBefore, 'Juiced reward claim transferred no rewards')
        return undefined
      })
    } finally {
      await rpc('evm_revert', [juicedRewardsSnapshotId])
    }

    await runFlow('Juiced staking reward claim from an existing EOA position', async () => {
      const config = await createKongVaultConfigResolver().resolve(CANONICAL_CHAIN_ID, JUICED_DAI_VAULT)
      await rpc('tenderly_setBalance', [JUICED_REWARD_ACCOUNT, toHex(parseEther('1'))])
      const rewards = await createHttpRewardDiscoveryService().discover({
        account: JUICED_REWARD_ACCOUNT,
        config,
        publicClient
      })
      const reward = rewards.find(({ kind }) => kind === 'staking')
      invariant(reward, 'Existing Juiced position has no discoverable reward')

      const balanceBefore = await publicClient.readContract({
        abi: erc20Abi,
        address: reward.token.address,
        args: [JUICED_REWARD_ACCOUNT],
        functionName: 'balanceOf'
      })
      await send(reward.quote.transaction, 'Claim rewards', JUICED_REWARD_ACCOUNT)
      const balanceAfter = await publicClient.readContract({
        abi: erc20Abi,
        address: reward.token.address,
        args: [JUICED_REWARD_ACCOUNT],
        functionName: 'balanceOf'
      })
      invariant(balanceAfter > balanceBefore, 'Existing Juiced position reward claim transferred no rewards')
    })

    await runFlow('Enso same-chain DAI deposit to yvUSD', async () => {
      const config = createYvUsdPreset({ variant: 'unlocked' })
      const sourceToken: VaultWidgetToken = {
        address: DAI_ADDRESS,
        chainId: CANONICAL_CHAIN_ID,
        decimals: 18,
        name: 'Dai Stablecoin',
        symbol: 'DAI'
      }
      const amount = parseUnits('1000', sourceToken.decimals)
      const adapter = createEnsoAdapter({
        asset: config.depositTokens[0]!,
        destinationChainId: CANONICAL_CHAIN_ID,
        modes: ['deposit'],
        positionToken: config.positionToken,
        provider: ensoProvider,
        routerByChain: ENSO_ROUTER_BY_CHAIN
      })

      await setTokenBalance(sourceToken.address, amount)
      const positionBefore = await balanceOf(config.positionToken.address)
      const quote = await adapter.quote(
        createRequest({
          amount,
          config,
          mode: 'deposit',
          selectedToken: sourceToken
        }),
        publicClient
      )
      invariant(!quote.isCrossChain && !quote.bridge, 'Same-chain Enso route unexpectedly contains a bridge')
      invariant(quote.approval, 'Same-chain Enso route is missing its source approval')
      await approve(sourceToken.address, quote.approval.spender, quote.approval.amount)
      await send(quote.transaction, 'Execute Enso same-chain deposit')
      invariant(
        (await balanceOf(config.positionToken.address)) > positionBefore,
        'Enso deposit produced no yvUSD shares'
      )
    })

    const optimismSnapshotId = await optimismRpc<string>('evm_snapshot')
    try {
      await runFlow('Enso Optimism-to-mainnet source execution', async () => {
        const config = createYvUsdPreset({ variant: 'unlocked' })
        const sourceToken: VaultWidgetToken = {
          address: OPTIMISM_USDC,
          chainId: 10,
          decimals: 6,
          name: 'USD Coin',
          symbol: 'USDC'
        }
        const amount = parseUnits('1000', sourceToken.decimals)
        const adapter = createEnsoAdapter({
          asset: config.depositTokens[0]!,
          destinationChainId: CANONICAL_CHAIN_ID,
          modes: ['deposit'],
          positionToken: config.positionToken,
          provider: ensoProvider,
          routerByChain: ENSO_ROUTER_BY_CHAIN
        })

        await optimismRpc('tenderly_setBalance', [QA_ACCOUNT, toHex(parseEther('1'))])
        await setOptimismTokenBalance(sourceToken.address, amount)
        const quote = await adapter.quote(
          createRequest({
            amount,
            chainId: 10,
            config,
            mode: 'deposit',
            selectedToken: sourceToken
          }),
          optimismPublicClient
        )
        invariant(quote.isCrossChain && quote.bridge, 'Enso route did not preserve cross-chain tracking')
        invariant(quote.bridge.sourceChainId === 10, 'Enso route has the wrong source chain')
        invariant(quote.bridge.destinationChainId === 1, 'Enso route has the wrong destination chain')
        invariant(quote.approval, 'Enso cross-chain route is missing its source approval')
        await approveOptimism(sourceToken.address, quote.approval.spender, quote.approval.amount)
        await sendOptimism(quote.transaction, 'Execute Enso cross-chain source')
        const remaining = await optimismPublicClient.readContract({
          abi: erc20Abi,
          address: sourceToken.address,
          args: [QA_ACCOUNT],
          functionName: 'balanceOf'
        })
        invariant(remaining < amount, 'Enso cross-chain source execution spent no input tokens')
        return {
          coverage: 'partial-stateful',
          note: 'Source approval and router transaction executed; destination delivery requires an external bridge relayer.'
        }
      })
    } finally {
      await optimismRpc('evm_revert', [optimismSnapshotId])
    }
  } finally {
    const reverted = await rpc<boolean>('evm_revert', [snapshotId])
    invariant(reverted, 'Unable to revert the Tenderly QA snapshot')
  }

  console.log(
    JSON.stringify(
      {
        account: QA_ACCOUNT,
        canonicalChainId: CANONICAL_CHAIN_ID,
        executionChainId: await publicClient.getChainId(),
        flows: results,
        revertedAfterRun: true,
        transactions: transactionCount
      },
      null,
      2
    )
  )
}

await main()
