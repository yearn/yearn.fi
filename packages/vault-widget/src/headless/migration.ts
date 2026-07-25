import {
  type Address,
  encodeFunctionData,
  formatUnits,
  type Hex,
  hexToNumber,
  isAddressEqual,
  type PublicClient,
  slice
} from 'viem'
import type { VaultWidgetQuote, VaultWidgetToken, VaultWidgetWalletType } from '../types'

export const YEARN_4626_ROUTER_ADDRESS = '0x1112dbCF805682e828606f74AB717abf4b4FD8DE' as Address
export const YEARN_VAULT_MIGRATOR_ADDRESSES = [
  '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c',
  '0x1824df8d751704fa10fa371d62a37f9b8772ab90'
] as const satisfies readonly Address[]
export const YEARN_VECRV_ZAP_ADDRESS = '0xdc899AB992fbCFbac936CE5a5bC5A86a5d35A66a' as Address

export const MIGRATION_ROUTER_ABI = [
  {
    inputs: [
      { name: 'fromVault', type: 'address' },
      { name: 'toVault', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'minSharesOut', type: 'uint256' }
    ],
    name: 'migrate',
    outputs: [{ name: 'sharesOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'fromVault', type: 'address' },
      { name: 'toVault', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'minSharesOut', type: 'uint256' }
    ],
    name: 'migrateFromV2',
    outputs: [{ name: 'sharesOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' }
    ],
    name: 'selfPermit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{ name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const

const VAULT_MIGRATOR_ABI = [
  {
    inputs: [
      { name: 'vaultFrom', type: 'address' },
      { name: 'vaultTo', type: 'address' },
      { name: 'shares', type: 'uint256' }
    ],
    name: 'migrateShares',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

const VECRV_ZAP_ABI = [
  {
    inputs: [
      { name: 'vaultFrom', type: 'address' },
      { name: 'vaultTo', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'minSharesOut', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ],
    name: 'zap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export type VaultWidgetPermitSignature = {
  chainId: number
  deadline: bigint
  owner: Address
  r: Hex
  s: Hex
  spender: Address
  token: Address
  value: bigint
  v: number
}

export type CreateMigrationQuoteParams = {
  account: Address
  chainId: number
  currentTimestamp?: bigint
  fromToken: VaultWidgetToken
  migratorAddress: Address
  permit?: VaultWidgetPermitSignature
  shares: bigint
  sourceVersion?: string
  toVault: Address
}

export type SplitMigrationPermitSignatureParams = {
  chainId: number
  deadline: bigint
  owner: Address
  spender: Address
  token: Address
  value: bigint
}

function isV3(version?: string): boolean {
  return version?.startsWith('3') === true || version?.startsWith('~3') === true
}

export function supportsMigrationPermit(params: { migratorAddress: Address; sourceVersion?: string }): boolean {
  const usesKnownMigrator = YEARN_VAULT_MIGRATOR_ADDRESSES.some((address) =>
    isAddressEqual(address, params.migratorAddress)
  )
  return (
    isV3(params.sourceVersion) && !usesKnownMigrator && !isAddressEqual(params.migratorAddress, YEARN_VECRV_ZAP_ADDRESS)
  )
}

export function getMigrationAuthorizationMode(params: {
  permitSupported: boolean
  walletType: VaultWidgetWalletType
}): 'approval' | 'permit' {
  return params.permitSupported && params.walletType === 'eoa' ? 'permit' : 'approval'
}

const PERMIT_METADATA_ABI = [
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'PERMIT_TYPEHASH',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'apiVersion',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

const EIP2612_PERMIT_TYPEHASH = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'

export async function detectMigrationPermitSupport(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    await publicClient.readContract({
      address: tokenAddress,
      abi: PERMIT_METADATA_ABI,
      functionName: 'DOMAIN_SEPARATOR'
    })
    try {
      const typehash = await publicClient.readContract({
        address: tokenAddress,
        abi: PERMIT_METADATA_ABI,
        functionName: 'PERMIT_TYPEHASH'
      })
      return typehash === EIP2612_PERMIT_TYPEHASH
    } catch {
      return true
    }
  } catch {
    return false
  }
}

export async function readMigrationPermitTypedData(params: {
  account: Address
  chainId: number
  deadline: bigint
  publicClient: PublicClient
  spender: Address
  tokenAddress: Address
  value: bigint
}): Promise<{
  domain: { chainId: number; name: string; verifyingContract: Address; version: string }
  message: { deadline: bigint; nonce: bigint; owner: Address; spender: Address; value: bigint }
  primaryType: 'Permit'
  types: { Permit: readonly { name: string; type: string }[] }
}> {
  const [nonceResult, versionResult, apiVersionResult] = await Promise.allSettled([
    params.publicClient.readContract({
      address: params.tokenAddress,
      abi: PERMIT_METADATA_ABI,
      functionName: 'nonces',
      args: [params.account]
    }),
    params.publicClient.readContract({
      address: params.tokenAddress,
      abi: PERMIT_METADATA_ABI,
      functionName: 'version'
    }),
    params.publicClient.readContract({
      address: params.tokenAddress,
      abi: PERMIT_METADATA_ABI,
      functionName: 'apiVersion'
    })
  ])
  if (nonceResult.status === 'rejected') {
    throw new Error('Unable to read the migration permit nonce')
  }
  const nonce = nonceResult.value
  const version =
    apiVersionResult.status === 'fulfilled' && apiVersionResult.value
      ? apiVersionResult.value
      : versionResult.status === 'fulfilled' && versionResult.value
        ? versionResult.value
        : '1'

  return {
    domain: {
      chainId: params.chainId,
      name: 'Yearn Vault',
      verifyingContract: params.tokenAddress,
      version
    },
    message: {
      deadline: params.deadline,
      nonce,
      owner: params.account,
      spender: params.spender,
      value: params.value
    },
    primaryType: 'Permit',
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    }
  }
}

export function splitMigrationPermitSignature(
  signature: Hex,
  params: SplitMigrationPermitSignatureParams
): VaultWidgetPermitSignature {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error('Migration permit signature must be 65 bytes')
  }
  const recoveryId = hexToNumber(slice(signature, 64, 65))
  const v = recoveryId < 27 ? recoveryId + 27 : recoveryId
  if (v !== 27 && v !== 28) throw new Error('Migration permit signature has an invalid recovery ID')
  return {
    ...params,
    r: slice(signature, 0, 32),
    s: slice(signature, 32, 64),
    v
  }
}

export function isMigrationPermitValid(params: {
  account: Address
  chainId: number
  currentTimestamp: bigint
  permit: VaultWidgetPermitSignature
  spender: Address
  token: Address
  value: bigint
}): boolean {
  return (
    params.permit.deadline > params.currentTimestamp &&
    params.permit.chainId === params.chainId &&
    isAddressEqual(params.permit.owner, params.account) &&
    isAddressEqual(params.permit.spender, params.spender) &&
    isAddressEqual(params.permit.token, params.token) &&
    params.permit.value === params.value
  )
}

export function createMigrationQuote(params: CreateMigrationQuoteParams): VaultWidgetQuote {
  if (params.shares <= 0n) throw new Error('Migration shares must be greater than zero')
  const knownVaultMigrator = YEARN_VAULT_MIGRATOR_ADDRESSES.find((address) =>
    isAddressEqual(address, params.migratorAddress)
  )
  const usesVeCrvZap = isAddressEqual(params.migratorAddress, YEARN_VECRV_ZAP_ADDRESS)
  const router = knownVaultMigrator ?? (usesVeCrvZap ? YEARN_VECRV_ZAP_ADDRESS : YEARN_4626_ROUTER_ADDRESS)
  const functionName = isV3(params.sourceVersion) ? 'migrate' : 'migrateFromV2'
  const migrationData = knownVaultMigrator
    ? encodeFunctionData({
        abi: VAULT_MIGRATOR_ABI,
        functionName: 'migrateShares',
        args: [params.fromToken.address, params.toVault, params.shares]
      })
    : usesVeCrvZap
      ? encodeFunctionData({
          abi: VECRV_ZAP_ABI,
          functionName: 'zap',
          args: [params.fromToken.address, params.toVault, params.shares, 0n, params.account]
        })
      : encodeFunctionData({
          abi: MIGRATION_ROUTER_ABI,
          functionName,
          args: [params.fromToken.address, params.toVault, params.shares, 0n]
        })
  const supportsPermit = supportsMigrationPermit(params)
  if (params.permit) {
    if (!supportsPermit) throw new Error('Migration permit is not supported for this route')
    if (params.currentTimestamp === undefined) {
      throw new Error('Migration permit validation requires the current chain timestamp')
    }
    if (
      !isMigrationPermitValid({
        account: params.account,
        chainId: params.chainId,
        currentTimestamp: params.currentTimestamp,
        permit: params.permit,
        spender: router,
        token: params.fromToken.address,
        value: params.shares
      })
    ) {
      throw new Error('Migration permit is expired or does not match the migration request')
    }
  }
  const usesPermit = supportsPermit && !!params.permit
  const transactionData =
    usesPermit && params.permit
      ? encodeFunctionData({
          abi: MIGRATION_ROUTER_ABI,
          functionName: 'multicall',
          args: [
            [
              encodeFunctionData({
                abi: MIGRATION_ROUTER_ABI,
                functionName: 'selfPermit',
                args: [
                  params.fromToken.address,
                  params.shares,
                  params.permit.deadline,
                  params.permit.v,
                  params.permit.r,
                  params.permit.s
                ]
              }),
              migrationData
            ]
          ]
        })
      : migrationData

  return {
    actionLabel: usesPermit ? 'Permit & Migrate' : 'Migrate',
    activityAmount: formatUnits(params.shares, params.fromToken.decimals),
    activityTokenIn: params.fromToken.address,
    activityTokenOut: params.toVault,
    activityType: 'migrate',
    adapterId: usesPermit ? 'migration-permit' : 'migration-approval',
    amountIn: params.shares,
    expectedOut: 0n,
    hideDetails: true,
    minExpectedOut: 0n,
    notice: 'Move the complete vault-share balance to the replacement vault.',
    positionAmount: params.shares,
    approval: usesPermit
      ? undefined
      : {
          amount: params.shares,
          spender: router,
          token: params.fromToken
        },
    transaction: {
      chainId: params.chainId,
      data: transactionData,
      to: router
    }
  }
}
