import {
  GOVERNANCE_CHAIN_ID,
  GOVERNANCE_ERC20_ABI,
  LEGACY_VEYFI_ABI,
  LEGACY_VEYFI_ADDRESS,
  LIQUID_LOCKER_DEPOSITOR_ABI,
  LIQUID_LOCKER_REWARD_DISTRIBUTOR_ADDRESS,
  LIQUID_LOCKERS,
  REWARD_CLAIMER_ABI,
  REWARD_CLAIMER_ADDRESS,
  REWARD_DISTRIBUTOR_ABI,
  STAKED_YFI_ABI,
  STYFI_ADDRESS,
  STYFIX_ADDRESS,
  VEYFI_REWARD_DISTRIBUTOR_ADDRESS,
  YFI_ADDRESS,
  YVUSDC_REWARD_ADDRESS
} from '@pages/portfolio/governance/constants'
import { deriveGovernancePositions } from '@pages/portfolio/governance/deriveGovernancePositions'
import type {
  TGovernanceGlobalData,
  TGovernancePosition,
  TGovernanceRawAccount,
  TGovernanceRawLiquidLockerAccount,
  TGovernanceRawReward
} from '@pages/portfolio/governance/types'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { usePublicClient } from '@shared/hooks/useAppWagmi'
import { useYearnSpotPrices } from '@shared/hooks/useYearnSpotPrices'
import type { TAddress } from '@shared/types'
import { toAddress } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ContractFunctionParameters, PublicClient } from 'viem'

type TUseGovernancePositionsReturn = {
  positions: TGovernancePosition[]
  totalValueUsd: number
  isLoading: boolean
}

const ZERO_STREAM = [0n, 0n, 0n] as const

function getBigIntResult(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n
}

function getStreamResult(value: unknown): readonly [bigint, bigint, bigint] {
  return Array.isArray(value) && value.length >= 3
    ? [getBigIntResult(value[0]), getBigIntResult(value[1]), getBigIntResult(value[2])]
    : ZERO_STREAM
}

function getLockInfoResult(value: unknown): { amount: bigint; boostEpochs: bigint | null; unlockTime: bigint } {
  if (Array.isArray(value)) {
    return {
      amount: getBigIntResult(value[0]),
      boostEpochs: typeof value[1] === 'bigint' ? value[1] : null,
      unlockTime: getBigIntResult(value[2])
    }
  }

  const lockInfo = value as { amount?: unknown; boost_epochs?: unknown; unlock_time?: unknown } | null
  return {
    amount: getBigIntResult(lockInfo?.amount),
    boostEpochs: typeof lockInfo?.boost_epochs === 'bigint' ? lockInfo.boost_epochs : null,
    unlockTime: getBigIntResult(lockInfo?.unlock_time)
  }
}

function getMulticallValue<T>(
  result: { status: 'success'; result: T } | { status: 'failure'; error: unknown }
): T | null {
  return result.status === 'success' ? result.result : null
}

async function getRewardToken(publicClient: PublicClient, distributorAddress: TAddress): Promise<TAddress> {
  try {
    const tokenAddress = await publicClient.readContract({
      address: distributorAddress,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'token'
    })
    return toAddress(tokenAddress)
  } catch {
    return YVUSDC_REWARD_ADDRESS
  }
}

async function getRewardTokenMetadata(
  publicClient: PublicClient,
  tokenAddress: TAddress
): Promise<{ symbol: string; decimals: number }> {
  try {
    const [symbol, decimals] = await publicClient.multicall({
      contracts: [
        { address: tokenAddress, abi: GOVERNANCE_ERC20_ABI, functionName: 'symbol' },
        { address: tokenAddress, abi: GOVERNANCE_ERC20_ABI, functionName: 'decimals' }
      ],
      allowFailure: false
    })

    return { symbol, decimals }
  } catch {
    return { symbol: tokenAddress === YVUSDC_REWARD_ADDRESS ? 'yvUSDC' : 'Reward', decimals: 18 }
  }
}

async function simulateRewardClaim(params: {
  publicClient: PublicClient
  account: TAddress
  contractAddress: TAddress
  tokenAddress: TAddress
  isRewardClaimer?: boolean
}): Promise<TGovernanceRawReward | null> {
  const { account, contractAddress, isRewardClaimer = false, publicClient, tokenAddress } = params
  try {
    const { result } = await publicClient.simulateContract({
      address: contractAddress,
      abi: isRewardClaimer ? REWARD_CLAIMER_ABI : REWARD_DISTRIBUTOR_ABI,
      functionName: 'claim',
      args: [account],
      account
    })
    const amountRaw = getBigIntResult(result)
    if (amountRaw <= 0n) {
      return null
    }

    const metadata = await getRewardTokenMetadata(publicClient, tokenAddress)
    return {
      amountRaw,
      tokenAddress,
      tokenSymbol: metadata.symbol,
      tokenDecimals: metadata.decimals
    }
  } catch {
    return null
  }
}

async function fetchGovernanceRawAccount(
  publicClient: PublicClient,
  account: TAddress
): Promise<TGovernanceRawAccount> {
  const [veYfiRewardToken, liquidLockerRewardToken] = await Promise.all([
    getRewardToken(publicClient, VEYFI_REWARD_DISTRIBUTOR_ADDRESS),
    getRewardToken(publicClient, LIQUID_LOCKER_REWARD_DISTRIBUTOR_ADDRESS)
  ])
  const accountContracts = [
    { address: STYFI_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'balanceOf', args: [account] },
    { address: STYFI_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'streams', args: [account] },
    { address: STYFI_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'maxWithdraw', args: [account] },
    { address: STYFIX_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'balanceOf', args: [account] },
    { address: STYFIX_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'streams', args: [account] },
    { address: STYFIX_ADDRESS, abi: STAKED_YFI_ABI, functionName: 'maxWithdraw', args: [account] },
    { address: LEGACY_VEYFI_ADDRESS, abi: LEGACY_VEYFI_ABI, functionName: 'locked', args: [account] },
    {
      address: VEYFI_REWARD_DISTRIBUTOR_ADDRESS,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'check_lock',
      args: [account]
    },
    {
      address: VEYFI_REWARD_DISTRIBUTOR_ADDRESS,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'locks',
      args: [account]
    },
    {
      address: VEYFI_REWARD_DISTRIBUTOR_ADDRESS,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'last_claimed',
      args: [account]
    },
    ...LIQUID_LOCKERS.flatMap((locker) => [
      { address: locker.token, abi: GOVERNANCE_ERC20_ABI, functionName: 'balanceOf', args: [account] as const },
      {
        address: locker.depositor,
        abi: LIQUID_LOCKER_DEPOSITOR_ABI,
        functionName: 'balanceOf',
        args: [account] as const
      },
      {
        address: locker.depositor,
        abi: LIQUID_LOCKER_DEPOSITOR_ABI,
        functionName: 'streams',
        args: [account] as const
      },
      {
        address: locker.depositor,
        abi: LIQUID_LOCKER_DEPOSITOR_ABI,
        functionName: 'maxWithdraw',
        args: [account] as const
      }
    ])
  ] as readonly ContractFunctionParameters[]
  const [accountReads, styfiReward, veYfiReward, liquidLockerReward] = await Promise.all([
    publicClient.multicall({
      contracts: accountContracts,
      allowFailure: true
    }),
    simulateRewardClaim({
      publicClient,
      account,
      contractAddress: REWARD_CLAIMER_ADDRESS,
      tokenAddress: YVUSDC_REWARD_ADDRESS,
      isRewardClaimer: true
    }),
    simulateRewardClaim({
      publicClient,
      account,
      contractAddress: VEYFI_REWARD_DISTRIBUTOR_ADDRESS,
      tokenAddress: veYfiRewardToken
    }),
    simulateRewardClaim({
      publicClient,
      account,
      contractAddress: LIQUID_LOCKER_REWARD_DISTRIBUTOR_ADDRESS,
      tokenAddress: liquidLockerRewardToken
    })
  ])

  const getRead = (index: number): unknown => getMulticallValue(accountReads[index] as never)
  const legacyLock = getRead(6)
  const lockInfo = getLockInfoResult(getRead(8))
  const snapshotCheck = getRead(7)
  const snapshotValidAmount = Array.isArray(snapshotCheck) ? getBigIntResult(snapshotCheck[0]) : 0n
  const lockedAmount = lockInfo.amount
  const lastClaimed = getBigIntResult(getRead(9))
  const migrated = lastClaimed > 0n
  const boostEpochsNumber = lockInfo.boostEpochs === null ? Number.NaN : Number(lockInfo.boostEpochs)
  const lockerStart = 10
  const readsPerLocker = 4
  const liquidLockers: TGovernanceRawLiquidLockerAccount[] = LIQUID_LOCKERS.map((locker, index) => {
    const base = lockerStart + index * readsPerLocker
    return {
      id: locker.symbol,
      index: locker.index,
      name: locker.name,
      symbol: locker.symbol,
      tokenAddress: locker.token,
      scale: locker.scale,
      walletBalance: getBigIntResult(getRead(base)),
      stakedShares: getBigIntResult(getRead(base + 1)),
      stream: getStreamResult(getRead(base + 2)),
      withdrawable: getBigIntResult(getRead(base + 3))
    }
  })
  const liquidLockerRewardIndex = liquidLockerReward
    ? Math.max(
        0,
        liquidLockers.findIndex((locker) => {
          const streamRemainingShares = locker.stream[1] - locker.stream[2]
          return (
            locker.walletBalance > 0n ||
            locker.stakedShares > 0n ||
            streamRemainingShares > 0n ||
            locker.withdrawable > 0n
          )
        })
      )
    : -1

  return {
    styfi: {
      styfiActive: getBigIntResult(getRead(0)),
      styfiStream: getStreamResult(getRead(1)),
      styfiWithdrawable: getBigIntResult(getRead(2)),
      styfixActive: getBigIntResult(getRead(3)),
      styfixStream: getStreamResult(getRead(4)),
      styfixWithdrawable: getBigIntResult(getRead(5)),
      reward: styfiReward
    },
    veyfi: {
      legacyBalance: Array.isArray(legacyLock) ? getBigIntResult(legacyLock[0]) : 0n,
      lockedAmount: migrated ? lockedAmount : 0n,
      migrated,
      migrationEligible: !migrated && lockedAmount > 0n && snapshotValidAmount > 0n,
      unlockTime: Number(lockInfo.unlockTime),
      boostEpochs: Number.isFinite(boostEpochsNumber) ? Math.max(0, Math.floor(boostEpochsNumber)) : null,
      reward: veYfiReward
    },
    liquidLockers: liquidLockers.map((locker, index) =>
      index === liquidLockerRewardIndex && liquidLockerReward ? { ...locker, reward: liquidLockerReward } : locker
    )
  } as TGovernanceRawAccount
}

async function fetchGovernanceGlobalData(): Promise<TGovernanceGlobalData | null> {
  try {
    const response = await fetch('/api/governance/global-data')
    if (!response.ok) {
      return null
    }
    return (await response.json()) as TGovernanceGlobalData
  } catch {
    return null
  }
}

function getYfiPriceFromGlobalData(globalData: TGovernanceGlobalData | null | undefined): number {
  const priceCts = globalData?.global.yfi?.priceCts
  if (!priceCts) {
    return 0
  }

  const parsed = Number(priceCts)
  return Number.isFinite(parsed) ? parsed / 100 : 0
}

export function useGovernancePositions(enabled: boolean): TUseGovernancePositionsReturn {
  const { address } = useWeb3()
  const account = address ? toAddress(address) : undefined
  const publicClient = usePublicClient({ chainId: GOVERNANCE_CHAIN_ID })
  const rawQuery = useQuery({
    queryKey: ['portfolio-governance-positions', account],
    queryFn: () => fetchGovernanceRawAccount(publicClient as PublicClient, account as TAddress),
    enabled: Boolean(enabled && account && publicClient),
    staleTime: 30_000,
    refetchOnWindowFocus: true
  })
  const globalDataQuery = useQuery({
    queryKey: ['portfolio-governance-global-data'],
    queryFn: fetchGovernanceGlobalData,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  })
  const rewardPriceTokens = useMemo(() => {
    const rewards = [
      rawQuery.data?.styfi.reward,
      rawQuery.data?.veyfi.reward,
      ...(rawQuery.data?.liquidLockers.map((locker) => locker.reward ?? null) ?? [])
    ].flatMap((reward): { address: TAddress; chainID: number }[] =>
      reward ? [{ address: reward.tokenAddress, chainID: GOVERNANCE_CHAIN_ID }] : []
    )
    return [
      { address: YFI_ADDRESS, chainID: GOVERNANCE_CHAIN_ID },
      { address: YVUSDC_REWARD_ADDRESS, chainID: GOVERNANCE_CHAIN_ID },
      ...rewards
    ]
  }, [rawQuery.data])
  const { getPrice } = useYearnSpotPrices(rewardPriceTokens)
  const yfiSpotPrice = getPrice({ address: YFI_ADDRESS, chainID: GOVERNANCE_CHAIN_ID }).normalized
  const yfiPrice =
    Number.isFinite(yfiSpotPrice) && yfiSpotPrice > 0 ? yfiSpotPrice : getYfiPriceFromGlobalData(globalDataQuery.data)
  const positions = useMemo(
    () =>
      deriveGovernancePositions({
        raw: rawQuery.data,
        globalData: globalDataQuery.data,
        yfiPrice,
        getRewardPrice: (tokenAddress) => getPrice({ address: tokenAddress, chainID: GOVERNANCE_CHAIN_ID }).normalized
      }),
    [getPrice, globalDataQuery.data, rawQuery.data, yfiPrice]
  )
  const totalValueUsd = useMemo(
    () => positions.reduce((sum, position) => sum + (Number.isFinite(position.valueUsd) ? position.valueUsd : 0), 0),
    [positions]
  )

  return {
    positions,
    totalValueUsd,
    isLoading: enabled && (rawQuery.isLoading || globalDataQuery.isLoading)
  }
}
