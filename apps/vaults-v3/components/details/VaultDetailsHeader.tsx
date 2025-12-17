import { Counter } from '@lib/components/Counter'
import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TKatanaAprData } from '@lib/hooks/useKatanaAprs'
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
  isZero,
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
import { KatanaApyTooltip } from '@vaults-v3/components/table/KatanaApyTooltip'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { erc20Abi, zeroAddress } from 'viem'
import { useBlockNumber } from 'wagmi'
import { readContract, readContracts } from 'wagmi/actions'

type TVaultHeaderLineItemProps = {
  label: string
  children: ReactElement | string
  legend?: ReactElement | string
}

function VaultHeaderLineItem({ label, children, legend }: TVaultHeaderLineItemProps): ReactElement {
  return (
    <div
      className={'flex flex-col items-center justify-center space-y-1 overflow-hidden md:space-y-2 md:overflow-visible'}
    >
      <p className={'text-center text-xs text-neutral-900/70'}>{label}</p>
      <b className={'font-number text-base md:text-3xl'} suppressHydrationWarning>
        {children}
      </b>
      <legend
        className={'font-number whitespace-nowrap text-center text-xs text-neutral-900/70'}
        suppressHydrationWarning
      >
        {legend ? legend : '\u00A0'}
      </legend>
    </div>
  )
}

function VaultAPY({
  apr,
  source,
  katanaExtras,
  currentVault
}: {
  apr: TYDaemonVault['apr']
  source: string
  chain: number
  katanaExtras?: TKatanaAprData
  currentVault: TYDaemonVault
}): ReactElement {
  const apyData = useVaultApyData(currentVault)
  const extraAPY = apr.extra.stakingRewardsAPR + apr.extra.gammaRewardAPR
  const monthlyAPY = apr.points.monthAgo
  const weeklyAPY = apr.points.weekAgo
  const netAPY = apr.netAPR + extraAPY
  const currentAPY = apr.forwardAPR.netAPR + extraAPY
  const isSourceVeYFI = source === 'VeYFI'

  const katanaNetAPY = useMemo(() => apyData.katanaTotalApr || 0, [apyData.katanaTotalApr])

  if (katanaExtras) {
    return (
      <VaultHeaderLineItem
        label={'Estimated APR'}
        legend={
          <KatanaApyTooltip
            katanaNativeYield={katanaExtras.katanaNativeYield ?? 0}
            fixedRateKatanRewardsAPR={katanaExtras.FixedRateKatanaRewards ?? 0}
            katanaAppRewardsAPR={katanaExtras.katanaAppRewardsAPR ?? katanaExtras.katanaRewardsAPR ?? 0}
            katanaBonusAPR={katanaExtras.katanaBonusAPY ?? 0}
            steerPointsPerDollar={katanaExtras.steerPointsPerDollar}
            currentVault={currentVault}
            position="top"
            maxWidth="w-max"
            className={'items-center justify-center md:justify-center'}
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <div>{'APR Breakdown '}</div>
              <IconQuestion className={'hidden md:block'} />
            </div>
          </KatanaApyTooltip>
        }
      >
        <Renderable shouldRender={!apr?.type.includes('new')} fallback={'New'}>
          <RenderAmount value={katanaNetAPY} symbol={'percent'} decimals={6} />
        </Renderable>
      </VaultHeaderLineItem>
    )
  }

  if (apr.forwardAPR.type === '' && extraAPY === 0) {
    return (
      <VaultHeaderLineItem label={'Historical APY'}>
        <Renderable shouldRender={true} fallback={'New'}>
          <RenderAmount value={netAPY} symbol={'percent'} decimals={6} />
        </Renderable>
      </VaultHeaderLineItem>
    )
  }

  if (apr.forwardAPR.type !== '' && extraAPY !== 0 && !isSourceVeYFI) {
    const boostedAPY = (apyData.baseForwardApr || apr.forwardAPR.netAPR) + (apyData.rewardsAprSum || extraAPY)
    return (
      <VaultHeaderLineItem
        label={'Historical APY'}
        legend={
          <span className={'tooltip'}>
            <div className={'flex flex-row items-center space-x-2'}>
              <div>
                {'Est. APY: '}
                <RenderAmount shouldHideTooltip={boostedAPY === 0} value={boostedAPY} symbol={'percent'} decimals={6} />
              </div>
              <IconQuestion className={'hidden md:block'} />
            </div>
            <span className={'tooltipLight top-full mt-2'}>
              <div
                className={
                  'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
                }
              >
                <p
                  className={
                    'font-number flex w-full flex-row justify-between text-wrap text-left text-neutral-400 md:w-80 md:text-xs'
                  }
                >
                  {'Estimated APY for the next period based on current data.'}
                </p>
                <div
                  className={
                    'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap py-1 text-neutral-400 md:text-xs'
                  }
                >
                  <p>{'• Base APY '}</p>
                  <span className={'font-number'}>
                    <RenderAmount
                      shouldHideTooltip
                      value={apyData.baseForwardApr || apr.forwardAPR.netAPR}
                      symbol={'percent'}
                      decimals={6}
                    />
                  </span>
                </div>

                <div
                  className={
                    'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                  }
                >
                  <p>{'• Rewards APY '}</p>
                  <span className={'font-number'}>
                    <RenderAmount
                      shouldHideTooltip
                      value={apyData.rewardsAprSum || extraAPY}
                      symbol={'percent'}
                      decimals={6}
                    />
                  </span>
                </div>
              </div>
            </span>
          </span>
        }
      >
        <Renderable shouldRender={!apr?.type.includes('new')} fallback={'New'}>
          <RenderAmount value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY} symbol={'percent'} decimals={6} />
        </Renderable>
      </VaultHeaderLineItem>
    )
  }

  return (
    <VaultHeaderLineItem
      label={'Historical APY'}
      legend={
        <span className={'tooltip'}>
          <div className={'flex flex-row items-center space-x-2'}>
            <div>
              {'Est. APY: '}
              <RenderAmount value={isZero(currentAPY) ? netAPY : currentAPY} symbol={'percent'} decimals={6} />
            </div>
            <IconQuestion className={'hidden md:block'} />
          </div>
          <span className={'tooltipLight top-full mt-2'}>
            <div
              className={
                'font-number -mx-12 w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
              }
            >
              <p
                className={
                  'font-number flex w-full flex-row justify-between text-wrap text-left text-neutral-400 md:w-80 md:text-xs'
                }
              >
                {'Estimated APY for the next period based on current data.'}
              </p>
              <div
                className={
                  'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap py-1 text-neutral-400 md:text-xs'
                }
              >
                <p>{'• Base APY '}</p>
                <RenderAmount
                  shouldHideTooltip
                  value={isZero(currentAPY) ? netAPY : currentAPY}
                  symbol={'percent'}
                  decimals={6}
                />
              </div>

              <div
                className={
                  'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                }
              >
                <p>{'• Rewards APY '}</p>
                <p>{'N/A'}</p>
              </div>
            </div>
          </span>
        </span>
      }
    >
      <Renderable shouldRender={!apr?.type.includes('new')} fallback={'New'}>
        <RenderAmount value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY} symbol={'percent'} decimals={6} />
      </Renderable>
    </VaultHeaderLineItem>
  )
}

/**************************************************************************************************
 ** TVLInVault will render a block of two values: the total value locked in the vault along with
 ** the value of the vault in USD.
 *************************************************************************************************/
function TVLInVault(props: { tokenSymbol: string; tvl: number; totalAssets: bigint; decimals: number }): ReactElement {
  return (
    <VaultHeaderLineItem label={`Total deposited, ${props.tokenSymbol || 'tokens'}`} legend={formatUSD(props.tvl)}>
      <Counter
        value={toNormalizedBN(props.totalAssets, props.decimals).normalized}
        decimals={props.decimals}
        decimalsToDisplay={[2, 6, 8, 10, 12]}
      />
    </VaultHeaderLineItem>
  )
}

/**************************************************************************************************
 ** ValueInVaultAsToken will render a block of two values: the value of token we can redeem from
 ** the vault based on the amount of yvToken deposited, along with the value of the token in USD.
 *************************************************************************************************/
function ValueInVaultAsToken(props: {
  currentVault: TYDaemonVault
  vaultPrice: number
  valueInToken: TNormalizedBN
}): ReactElement {
  return (
    <VaultHeaderLineItem
      label={`Value in ${props.currentVault.token.symbol || 'tokens'}`}
      legend={
        <span className={'tooltip'}>
          <div className={'flex flex-row items-center space-x-2'}>
            <div>
              {'$'}
              <Counter
                value={props.valueInToken.normalized * props.vaultPrice}
                decimals={2}
                decimalsToDisplay={[2, 4, 6, 8]}
              />
            </div>
            <IconQuestion className={'hidden md:block'} />
          </div>
          <span className={'tooltipLight top-full mt-2'}>
            <div
              className={
                '-mx-12 w-fit rounded-xl border border-neutral-300 bg-neutral-200 p-4 text-center text-xs text-neutral-900'
              }
            >
              <p className={'flex w-full flex-row justify-between text-neutral-700 md:text-xs'}>
                {'Your yield is accruing every single block. Go you!'}
              </p>
            </div>
          </span>
        </span>
      }
    >
      <Counter
        value={props.valueInToken.normalized}
        decimals={props.currentVault.decimals}
        idealDecimals={2}
        decimalsToDisplay={[6, 8, 10, 12]}
      />
    </VaultHeaderLineItem>
  )
}

/**************************************************************************************************
 ** ValueEarned will render a block of two values: the amount of rewards earned by the user in the
 ** vault, along with the value of the rewards in USD.
 ** This is only displayed if the vault has a staking contract.
 *************************************************************************************************/
function ValueEarned(props: {
  currentVault: TYDaemonVault
  rewardTokenSymbol: string
  rewardTokenDecimal: number
  earnedValue: number
  earnedAmount: TNormalizedBN
}): ReactElement {
  return (
    <VaultHeaderLineItem
      label={`Extra earned, ${props.rewardTokenSymbol}`}
      legend={
        <span className={'tooltip'}>
          <div className={'flex flex-row items-center space-x-2'}>
            <div>
              {'$'}
              <Counter value={props.earnedValue} decimals={2} decimalsToDisplay={[2, 4, 6, 8]} />
            </div>
            <IconQuestion className={'hidden md:block'} />
          </div>
          <span className={'tooltipLight top-full mt-2'}>
            <div
              className={
                '-mx-12 w-fit rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-center text-xxs text-neutral-900'
              }
            >
              <p className={'flex w-full flex-row justify-between text-neutral-400 md:text-xs'}>
                {'Your yield is accruing every single block. Go you!'}
              </p>
            </div>
          </span>
        </span>
      }
    >
      <span className={'font-numer'}>
        <Counter
          value={props.earnedAmount.normalized}
          decimals={props.rewardTokenDecimal}
          idealDecimals={2}
          decimalsToDisplay={[8, 10, 12, 16, 18]}
        />
      </span>
    </VaultHeaderLineItem>
  )
}

export function VaultDetailsHeader({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { address } = useWeb3()
  const { getPrice } = useYearn()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const { apr, tvl, decimals, symbol = 'token' } = currentVault
  const [vaultData, setVaultData] = useState({
    deposited: zeroNormalizedBN,
    valueInToken: zeroNormalizedBN,
    earnedAmount: zeroNormalizedBN,
    rewardTokenSymbol: '',
    rewardTokenDecimal: 0,
    earnedValue: 0
  })

  const apyData = useVaultApyData(currentVault)

  const displayApr = useMemo((): TYDaemonVault['apr'] => {
    if (apyData.katanaTotalApr === undefined) return apr
    return { ...apr, netAPR: apyData.katanaTotalApr }
  }, [apr, apyData.katanaTotalApr])

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

  return (
    <div className={'col-span-12 mt-4 flex w-full flex-col items-center justify-center'}>
      <strong
        className={cl(
          'mx-auto flex w-full flex-row items-center justify-center text-center',
          'text-3xl md:text-[64px] leading-[36px] md:leading-[72px]',
          'tabular-nums text-neutral-900 font-black'
        )}
      >
        {getVaultName(currentVault)}
      </strong>

      <div className={'mb-10 mt-6 flex flex-col justify-center md:mt-4'}>
        {currentVault.address ? (
          <button onClick={(): void => copyToClipboard(currentVault.address)}>
            <p className={'font-number text-center text-xxs text-neutral-900/70 md:text-xs'}>{currentVault.address}</p>
          </button>
        ) : (
          <p className={'text-xxs md:text-xs'}>&nbsp;</p>
        )}
        <div className={'mt-4 flex flex-col gap-2 md:flex-row md:justify-center'}>
          <div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
            <strong className={'text-sm font-black text-neutral-900 md:text-xl'}>{currentVault.token.name}</strong>
          </div>
          <div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
            <strong className={'text-sm font-black text-neutral-900 md:text-xl'}>
              {getNetwork(currentVault.chainID).name}
            </strong>
          </div>
          {currentVault?.info?.isBoosted ? (
            <div className={'w-full rounded-lg bg-neutral-900/30 px-4 py-2 text-center md:w-fit'}>
              <strong className={'text-sm font-black text-neutral-900 md:text-xl'}>{'⚡️ Boosted'}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cl(
          'grid grid-cols-2 gap-6 w-full md:px-10',
          currentVault.staking.available &&
            currentVault.staking.source !== 'yBOLD' &&
            currentVault.staking.source !== 'VeYFI'
            ? 'md:grid-cols-4'
            : 'md:grid-cols-3'
        )}
      >
        <div className={'w-full'}>
          <TVLInVault tokenSymbol={symbol} tvl={tvl.tvl} totalAssets={tvl.totalAssets} decimals={decimals} />
        </div>

        <div className={'w-full'}>
          <VaultAPY
            apr={displayApr}
            source={currentVault.staking.source}
            chain={currentVault.chainID}
            katanaExtras={apyData.katanaExtras}
            currentVault={currentVault}
          />
        </div>

        <div className={'w-full'}>
          <ValueInVaultAsToken
            currentVault={currentVault}
            valueInToken={vaultData.valueInToken}
            vaultPrice={tokenPrice}
          />
        </div>

        {currentVault.staking.available &&
        currentVault.staking.source !== 'yBOLD' &&
        currentVault.staking.source !== 'VeYFI' ? (
          <div className={'w-full'}>
            <ValueEarned
              currentVault={currentVault}
              earnedAmount={vaultData.earnedAmount}
              earnedValue={vaultData.earnedValue}
              rewardTokenSymbol={vaultData.rewardTokenSymbol}
              rewardTokenDecimal={vaultData.rewardTokenDecimal}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
