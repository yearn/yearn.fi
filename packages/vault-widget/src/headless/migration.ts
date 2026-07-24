import { type Address, encodeFunctionData, formatUnits, type Hex, isAddressEqual } from 'viem'
import type { VaultWidgetQuote, VaultWidgetToken } from '../types'

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
  deadline: bigint
  r: Hex
  s: Hex
  v: number
}

export type CreateMigrationQuoteParams = {
  account: Address
  chainId: number
  fromToken: VaultWidgetToken
  migratorAddress: Address
  permit?: VaultWidgetPermitSignature
  shares: bigint
  sourceVersion?: string
  toVault: Address
}

function isV3(version?: string): boolean {
  return version?.startsWith('3') === true || version?.startsWith('~3') === true
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
  const supportsPermit = !knownVaultMigrator && !usesVeCrvZap && isV3(params.sourceVersion)
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
