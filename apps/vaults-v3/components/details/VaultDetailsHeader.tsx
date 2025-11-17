import { Counter } from '@lib/components/Counter'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import { IconQuestion } from '@lib/icons/IconQuestion'
import type { TAddress, TNormalizedBN } from '@lib/types'
import {
  cl,
  decodeAsAddress,
  decodeAsBigInt,
  decodeAsNumber,
  decodeAsString,
  formatUSD,
  isZeroAddress,
  toAddress,
  toBigInt,
  toNormalizedBN,
  zeroNormalizedBN
} from '@lib/utils'
import { copyToClipboard, getVaultName } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { JUICED_STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/juicedStakingRewards.abi'
import { STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/stakingRewards.abi'
import { V3_STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/V3StakingRewards.abi'
import { VAULT_V3_ABI } from '@vaults-v2/utils/abi/vaultV3.abi'
import { VEYFI_GAUGE_ABI } from '@vaults-v2/utils/abi/veYFIGauge.abi'
import { VaultForwardAPY } from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults-v3/components/table/VaultHistoricalAPY'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { erc20Abi, zeroAddress } from 'viem'
import { useBlockNumber } from 'wagmi'
import { readContract, readContracts } from 'wagmi/actions'

type TVaultHoldingsData = {
  deposited: TNormalizedBN
  valueInToken: TNormalizedBN
  earnedAmount: TNormalizedBN
  rewardTokenSymbol: string
  rewardTokenDecimal: number
  earnedValue: number
}

function MetricHeader({ label, tooltip }: { label: string; tooltip?: string }): ReactElement {
  return (
    <p className={'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600'}>
      <span>{label}</span>
      {tooltip ? (
        <span title={tooltip} className={'inline-flex items-center'}>
          <IconQuestion className={'size-3 text-neutral-400'} aria-label={`${label} info`} />
        </span>
      ) : null}
    </p>
  )
}

function VaultOverviewCard({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const totalAssets = toNormalizedBN(currentVault.tvl.totalAssets, currentVault.decimals).normalized
  const metrics = [
    {
      key: 'est-apy',
      label: 'Est. APY',
      tooltip: 'Projected APY for the next period',
      content: (
        <VaultForwardAPY
          currentVault={currentVault}
          showSubline={false}
          className={'items-start text-left'}
          valueClassName={'text-[32px] leading-none md:text-[32px] font-normal'}
        />
      ),
      footnote: null
    },
    {
      key: 'historical-apy',
      label: '30 Day APY',
      tooltip: 'Average realized APY over the previous 30 days',
      content: (
        <VaultHistoricalAPY
          currentVault={currentVault}
          className={'items-start text-left'}
          valueClassName={'text-[32px] leading-none md:text-[32px] font-normal'}
        />
      ),
      footnote: null
    },
    {
      key: 'tvl',
      label: 'TVL',
      tooltip: 'Total value currently deposited into this vault',
      content: (
        <p className={'font-number text-[32px] leading-none md:text-[32px]'} suppressHydrationWarning>
          {formatUSD(currentVault.tvl?.tvl || 0)}
        </p>
      ),
      footnote: (
        <span className={'font-number text-xs text-neutral-500'} suppressHydrationWarning>
          <Counter value={totalAssets} decimals={currentVault.decimals} decimalsToDisplay={[2, 6, 8, 10, 12]} />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </span>
      )
    }
  ]

  return (
    <div
      className={cl(
        'rounded-3xl border border-neutral-200 bg-neutral-0/90 text-neutral-900 shadow-lg shadow-neutral-900/10',
        'backdrop-blur-sm'
      )}
    >
      <div className={'divide-y divide-neutral-200 md:flex md:divide-y-0'}>
        {metrics.map((metric, index) => (
          <div
            key={metric.key}
            className={cl(
              'flex flex-1 flex-col gap-2 px-5 py-4',
              index < metrics.length - 1 ? 'md:border-r md:border-neutral-200' : ''
            )}
          >
            <div className={'flex items-center justify-between'}>
              <MetricHeader label={metric.label} tooltip={metric.tooltip} />
              <span className={'text-xs font-semibold text-transparent'}>{'+'}</span>
            </div>
            <div className={'[&_b.yearn--table-data-section-item-value]:text-left'}>{metric.content}</div>
            {metric.footnote ? <div>{metric.footnote}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function UserHoldingsCard({
  currentVault,
  vaultData,
  tokenPrice
}: {
  currentVault: TYDaemonVault
  vaultData: TVaultHoldingsData
  tokenPrice: number
}): ReactElement {
  const underlyingValueUSD = vaultData.valueInToken.normalized * tokenPrice
  const hasDeposits = vaultData.deposited.raw > 0n

  const sections = [
    {
      key: 'underlying',
      label: 'Underlying',
      tooltip: 'Your redeemable balance of the vault’s underlying asset',
      content: (
        <span className={'font-number text-[32px] leading-none md:text-[32px] font-normal'} suppressHydrationWarning>
          <Counter
            value={vaultData.valueInToken.normalized}
            decimals={currentVault.decimals}
            idealDecimals={2}
            decimalsToDisplay={[6, 8, 10, 12]}
          />
        </span>
      ),
      footnote: formatUSD(underlyingValueUSD)
    },
    {
      key: 'deposited',
      label: 'Deposited',
      tooltip: 'Your total position denominated in vault tokens',
      content: (
        <span className={'font-number text-[32px] leading-none md:text-[32px] font-normal'} suppressHydrationWarning>
          <Counter
            value={vaultData.deposited.normalized}
            decimals={currentVault.decimals}
            idealDecimals={2}
            decimalsToDisplay={[6, 8, 10, 12]}
          />
        </span>
      ),
      footnote: hasDeposits ? `${currentVault.symbol || 'Vault'} tokens` : 'No deposits yet'
    }
  ]

  return (
    <div
      className={cl(
        'rounded-3xl border border-neutral-200 bg-neutral-0/90 text-neutral-900 shadow-lg shadow-neutral-900/10',
        'backdrop-blur-sm'
      )}
    >
      <div className={'divide-y divide-neutral-200 md:flex md:divide-y-0'}>
        {sections.map((section, index) => (
          <div
            key={section.key}
            className={cl(
              'flex flex-1 flex-col gap-2 px-5 py-4',
              index < sections.length - 1 ? 'md:border-r md:border-neutral-200' : ''
            )}
          >
            <MetricHeader label={section.label} tooltip={section.tooltip} />
            <div>{section.content}</div>
            <p className={'text-xs text-neutral-500'} suppressHydrationWarning>
              {section.footnote}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VaultDetailsHeader({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { address } = useWeb3()
  const { getPrice } = useYearn()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const { decimals } = currentVault
  const [vaultData, setVaultData] = useState<TVaultHoldingsData>({
    deposited: zeroNormalizedBN,
    valueInToken: zeroNormalizedBN,
    earnedAmount: zeroNormalizedBN,
    rewardTokenSymbol: '',
    rewardTokenDecimal: 0,
    earnedValue: 0
  })

  const tokenPrice =
    useYearnTokenPrice({
      address: currentVault.token.address,
      chainID: currentVault.chainID
    }) || 0

  /**********************************************************************************************
   ** Retrieve some data from the vault and the staking contract to display a comprehensive view
   ** of the user's holdings in the vault.
   **********************************************************************************************/
  const refetch = useAsyncTrigger(async (): Promise<void> => {
    const stakingSource = currentVault.staking.source
    let balanceOf = 0n
    let stakingBalance = 0n
    let pps = 0n
    let rewardsToken: TAddress = zeroAddress
    let earned = 0n
    /******************************************************************************************
     ** To have the most up-to-date data, we fetch a few informations directly onChain, such as:
     ** - The user's balance in the vault
     ** - The user's balance in staking contract (0 if no staking contract)
     ** - The price per share of the vault (to calculate current value of the user's holdings)
     ** - The address of the rewards token
     ** - The amount of rewards earned by the user
     ******************************************************************************************/
    if (stakingSource === 'OP Boost' || stakingSource === 'VeYFI') {
      const result = await readContracts(retrieveConfig(), {
        contracts: [
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.staking.address),
            abi: erc20Abi,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'pricePerShare'
          },
          {
            address: toAddress(currentVault.staking.address),
            chainId: currentVault.chainID,
            abi: stakingSource === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
            functionName: stakingSource === 'OP Boost' ? 'rewardsToken' : 'REWARD_TOKEN'
          },
          {
            address: toAddress(currentVault.staking.address),
            abi: STAKING_REWARDS_ABI,
            chainId: currentVault.chainID,
            functionName: 'earned',
            args: [toAddress(address)]
          }
        ]
      })
      balanceOf = decodeAsBigInt(result[0])
      stakingBalance = decodeAsBigInt(result[1])
      pps = decodeAsBigInt(result[2])
      rewardsToken = decodeAsAddress(result[3])
      earned = decodeAsBigInt(result[4])
    } else if (stakingSource === 'Juiced') {
      const result = await readContracts(retrieveConfig(), {
        contracts: [
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.staking.address),
            abi: erc20Abi,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'pricePerShare'
          },
          {
            address: toAddress(currentVault.staking.address),
            chainId: currentVault.chainID,
            abi: JUICED_STAKING_REWARDS_ABI,
            functionName: 'rewardTokens',
            args: [0n]
          }
        ]
      })
      balanceOf = decodeAsBigInt(result[0])
      stakingBalance = decodeAsBigInt(result[1])
      pps = decodeAsBigInt(result[2])
      rewardsToken = decodeAsAddress(result[3])

      const earnedRaw = await readContract(retrieveConfig(), {
        address: toAddress(currentVault.staking.address),
        abi: JUICED_STAKING_REWARDS_ABI,
        chainId: currentVault.chainID,
        functionName: 'earned',
        args: [toAddress(address), rewardsToken]
      })

      earned = earnedRaw
    } else if (stakingSource === 'V3 Staking') {
      const rewardTokensLength = await readContract(retrieveConfig(), {
        address: toAddress(currentVault.staking.address),
        chainId: currentVault.chainID,
        abi: V3_STAKING_REWARDS_ABI,
        functionName: 'rewardTokensLength'
      })

      const rewardTokensCalls: Parameters<typeof readContracts>[1]['contracts'][number][] = []
      for (let i = 0; i < Number(rewardTokensLength); i++) {
        rewardTokensCalls.push({
          address: toAddress(currentVault.staking.address),
          chainId: currentVault.chainID,
          abi: V3_STAKING_REWARDS_ABI,
          functionName: 'rewardTokens',
          args: [toBigInt(i)]
        })
      }
      const result = await readContracts(retrieveConfig(), {
        contracts: [
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.staking.address),
            abi: erc20Abi,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'pricePerShare'
          },
          ...rewardTokensCalls
        ]
      })
      balanceOf = decodeAsBigInt(result[0])
      stakingBalance = decodeAsBigInt(result[1])
      pps = decodeAsBigInt(result[2])
      rewardsToken = decodeAsAddress(result[3])

      const earnedRaw = await readContract(retrieveConfig(), {
        address: toAddress(currentVault.staking.address),
        abi: V3_STAKING_REWARDS_ABI,
        chainId: currentVault.chainID,
        functionName: 'earned',
        args: [toAddress(address), rewardsToken]
      })
      earned = isZeroAddress(address) ? 0n : earnedRaw
    } else {
      const result = await readContracts(retrieveConfig(), {
        contracts: [
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.staking.address),
            abi: erc20Abi,
            chainId: currentVault.chainID,
            functionName: 'balanceOf',
            args: [toAddress(address)]
          },
          {
            address: toAddress(currentVault.address),
            abi: VAULT_V3_ABI,
            chainId: currentVault.chainID,
            functionName: 'pricePerShare'
          }
        ]
      })
      balanceOf = decodeAsBigInt(result[0])
      stakingBalance = decodeAsBigInt(result[1])
      pps = decodeAsBigInt(result[2])
    }
    const total = balanceOf + stakingBalance

    /******************************************************************************************
     ** Some extra elements are required at this point to be able to display a comprehensive
     ** view of the user's holdings in the vault: we need to know what is the reward token. This
     ** means we need to retrieve the token's symbol and decimals.
     ******************************************************************************************/
    const rewardResult = await readContracts(retrieveConfig(), {
      contracts: [
        {
          address: rewardsToken,
          abi: erc20Abi,
          chainId: currentVault.chainID,
          functionName: 'symbol'
        },
        {
          address: rewardsToken,
          abi: erc20Abi,
          chainId: currentVault.chainID,
          functionName: 'decimals'
        }
      ]
    })
    const rewardSymbol = decodeAsString(rewardResult[0])
    const rewardDecimals = decodeAsNumber(rewardResult[1])
    const priceOfRewardsToken = getPrice({ address: rewardsToken, chainID: 1 })
    const amountEarned = isZeroAddress(address) ? zeroNormalizedBN : toNormalizedBN(earned, rewardDecimals)
    const earnedValue = amountEarned.normalized * priceOfRewardsToken.normalized

    setVaultData({
      deposited: isZeroAddress(address) ? zeroNormalizedBN : toNormalizedBN(total, decimals),
      valueInToken: toNormalizedBN((total * pps) / toBigInt(10 ** decimals), decimals),
      rewardTokenSymbol: rewardSymbol,
      rewardTokenDecimal: rewardDecimals,
      earnedValue: earnedValue,
      earnedAmount: amountEarned
    })
  }, [
    address,
    currentVault.address,
    currentVault.chainID,
    currentVault.staking.address,
    currentVault.staking.source,
    decimals,
    getPrice
  ])

  /**********************************************************************************************
   ** As we want live data, we want the data to be refreshed every time the block number changes.
   ** This way, the user will always have the most up-to-date data.
   ** For Base chain (8453), we limit updates to reduce RPC calls and prevent rate limiting.
   **********************************************************************************************/

  useEffect(() => {
    if (currentVault.chainID === 8453) {
      if (blockNumber && Number(blockNumber) % 10 === 0) {
        refetch()
      }
    } else {
      refetch()
    }
  }, [blockNumber, refetch, currentVault.chainID])

  const chainName = getNetwork(currentVault.chainID).name
  const metadataLine = [chainName, currentVault.category, currentVault.kind].filter(Boolean).join(' • ')
  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
    currentVault.chainID
  }/${currentVault.token.address.toLowerCase()}/logo-128.png`

  return (
    <div className={'col-span-12 mt-4 flex w-full flex-col text-left'}>
      <div className={'flex flex-col gap-4'}>
        <div className={'flex flex-col gap-4 md:flex-row md:items-center'}>
          <div className={'flex items-center gap-4'}>
            <div className={'flex size-14 items-center justify-center rounded-full bg-neutral-0/70'}>
              <ImageWithFallback src={tokenLogoSrc} alt={currentVault.token.symbol || ''} width={56} height={56} />
            </div>
            <div className={'flex flex-col'}>
              <strong className={'text-3xl font-black leading-tight text-neutral-700 md:text-[56px] md:leading-[64px]'}>
                {getVaultName(currentVault)} {' yVault'}
              </strong>
              {currentVault.address ? (
                <button
                  type={'button'}
                  onClick={(): void => copyToClipboard(currentVault.address)}
                  className={
                    'text-left text-xs font-number text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-sm'
                  }
                >
                  {currentVault.address}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {metadataLine ? <p className={'text-sm text-neutral-900/70 md:text-base'}>{metadataLine}</p> : null}
      </div>

      <div className={'mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-5 md:items-start'}>
        <div className={'md:col-span-3'}>
          <VaultOverviewCard currentVault={currentVault} />
        </div>
        <div className={'md:col-span-2'}>
          <UserHoldingsCard currentVault={currentVault} vaultData={vaultData} tokenPrice={tokenPrice} />
        </div>
      </div>
    </div>
  )
}
