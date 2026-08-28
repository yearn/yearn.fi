export type TLot = {
  shares: bigint
  costBasis: bigint | null
  acquiredAt?: number
}

export type TRawScopes = {
  address: boolean
  tx: boolean
}

export type TRawPnlEvent =
  | {
      kind: 'deposit'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      owner: string
      sender: string
      shares: bigint
      assets: bigint
      scopes: TRawScopes
    }
  | {
      kind: 'withdrawal'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      owner: string
      shares: bigint
      assets: bigint
      scopes: TRawScopes
    }
  | {
      kind: 'transfer'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      sender: string
      receiver: string
      shares: bigint
      scopes: TRawScopes
    }
