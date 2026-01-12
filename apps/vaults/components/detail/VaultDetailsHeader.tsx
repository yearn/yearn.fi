import { Dialog, Transition } from '@headlessui/react'
import { useThemePreference } from '@hooks/useThemePreference'
import { Counter } from '@lib/components/Counter'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { JUICED_STAKING_REWARDS_ABI } from '@lib/contracts/abi/juicedStakingRewards.abi'
import { STAKING_REWARDS_ABI } from '@lib/contracts/abi/stakingRewards.abi'
import { V3_STAKING_REWARDS_ABI } from '@lib/contracts/abi/V3StakingRewards.abi'
import { VAULT_V3_ABI } from '@lib/contracts/abi/vaultV3.abi'
import { VEYFI_GAUGE_ABI } from '@lib/contracts/abi/veYFIGauge.abi'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
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
import { getVaultName } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { VaultForwardAPY } from '@vaults/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults/components/table/VaultHistoricalAPY'
import { useHeaderCompression } from '@vaults/hooks/useHeaderCompression'
import { useAvailableToDeposit } from '@vaults/utils/useAvailableToDeposit'
import type { ReactElement } from 'react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
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

const METRIC_VALUE_CLASS = 'font-semibold text-[20px] leading-tight md:text-[22px]'
const METRIC_FOOTNOTE_CLASS = 'text-xs text-text-secondary'

type TMetricBlock = {
  key: string
  header: ReactElement
  value: ReactElement
  footnote?: ReactElement
  secondaryLabel?: ReactElement
}

function MetricInfoModal({
  description,
  isOpen,
  onClose,
  title
}: {
  description?: string
  isOpen: boolean
  onClose: () => void
  title: string
}): ReactElement | null {
  if (!description) {
    return null
  }
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-50'} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter={'ease-out duration-300'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-200'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-neutral-900/30'} />
        </Transition.Child>

        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4 text-center'}>
            <Transition.Child
              as={Fragment}
              enter={'ease-out duration-300'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'ease-in duration-200'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-md transform overflow-hidden rounded-2xl bg-surface p-6 text-left align-middle shadow-lg transition-all'
                }
              >
                <Dialog.Title as={'h3'} className={'text-lg font-semibold leading-6 text-text-primary'}>
                  {title}
                </Dialog.Title>
                <p className={'mt-4 text-sm text-text-secondary'}>
                  {description}
                  <span className={'mt-2 block text-xs text-text-secondary'}>
                    {'More information about this metric is coming soon.'}
                  </span>
                </p>
                <div className={'mt-6'}>
                  <button
                    type={'button'}
                    className={
                      'inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-0 transition-colors hover:bg-neutral-800'
                    }
                    onClick={onClose}
                  >
                    {'Got it'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

function MetricsCard({
  hideFootnotes = false,
  items
}: {
  items: TMetricBlock[]
  hideFootnotes?: boolean
}): ReactElement {
  return (
    <div className={cl('rounded-lg border border-border bg-surface text-text-primary', 'backdrop-blur-sm')}>
      <div className={'divide-y divide-neutral-300 md:flex md:divide-y-0'}>
        {items.map(
          (item, index): ReactElement => (
            <div
              key={item.key}
              className={cl(
                'flex flex-1 flex-col gap-1 px-5 py-3',
                index < items.length - 1 ? 'md:border-r md:border-border' : ''
              )}
            >
              <div className={'flex items-center justify-between'}>{item.header}</div>
              <div className={'[&_b.yearn--table-data-section-item-value]:text-left font-semibold'}>{item.value}</div>
              {item.footnote && !hideFootnotes ? <div>{item.footnote}</div> : null}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function MetricHeader({ label, tooltip }: { label: string; tooltip?: string }): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <p className={'flex items-center gap-1 text-xs font-normal uppercase tracking-wide text-text-secondary'}>
        <span>{label}</span>
        {tooltip ? (
          <button
            type={'button'}
            onClick={(): void => setIsModalOpen(true)}
            aria-label={`Learn more about ${label}`}
            className={
              'inline-flex size-4 items-center justify-center rounded-full border bg-surface border-border text-[10px] font-normal text-text-secondary transition-colors hover:border-neutral-500 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300'
            }
          >
            <span className={'leading-none'}>{'i'}</span>
          </button>
        ) : null}
      </p>
      <MetricInfoModal
        description={tooltip}
        isOpen={isModalOpen}
        onClose={(): void => setIsModalOpen(false)}
        title={label}
      />
    </>
  )
}

function VaultOverviewCard({
  currentVault,
  isCompressed
}: {
  currentVault: TYDaemonVault
  isCompressed: boolean
}): ReactElement {
  const totalAssets = toNormalizedBN(currentVault.tvl.totalAssets, currentVault.decimals).normalized
  const metrics: TMetricBlock[] = [
    {
      key: 'est-apy',
      header: <MetricHeader label={'Est. APY'} tooltip={'Projected APY for the next period'} />,
      value: (
        <VaultForwardAPY
          currentVault={currentVault}
          showSubline={false}
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'historical-apy',
      header: <MetricHeader label={'30 Day APY'} tooltip={'Average realized APY over the previous 30 days'} />,
      value: (
        <VaultHistoricalAPY
          currentVault={currentVault}
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'tvl',
      header: <MetricHeader label={'TVL'} tooltip={'Total value currently deposited into this vault'} />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          <RenderAmount
            value={currentVault.tvl?.tvl || 0}
            symbol={'USD'}
            decimals={0}
            options={{
              shouldCompactValue: true,
              maximumFractionDigits: 2,
              minimumFractionDigits: 0
            }}
          />
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <span className={'font-number'}>
            <Counter value={totalAssets} decimals={currentVault.decimals} decimalsToDisplay={[2, 6, 8, 10, 12]} />
          </span>
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return <MetricsCard items={metrics} hideFootnotes={isCompressed} />
}

function UserHoldingsCard({
  currentVault,
  vaultData,
  tokenPrice,
  isCompressed
}: {
  currentVault: TYDaemonVault
  vaultData: TVaultHoldingsData
  tokenPrice: number
  isCompressed: boolean
}): ReactElement {
  const availableToDeposit = useAvailableToDeposit(currentVault)
  const availableAmount = toNormalizedBN(availableToDeposit, currentVault.token.decimals)
  const depositedValueUSD = vaultData.valueInToken.normalized * tokenPrice
  const availableValueUSD = availableAmount.normalized * tokenPrice

  const sections: TMetricBlock[] = [
    {
      key: 'available',
      header: (
        <MetricHeader
          label={'Available'}
          tooltip={'Track how much of the vault asset is already in your wallet and ready to be deposited.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(availableValueUSD)}
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(availableAmount.normalized)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.token.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(availableAmount.normalized) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    },
    {
      key: 'deposited',
      header: (
        <MetricHeader
          label={'Deposited'}
          tooltip={'Review the USD value of everything you have supplied to this vault so far.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(depositedValueUSD)}
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(vaultData.valueInToken.normalized)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.token.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(vaultData.valueInToken.normalized) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return <MetricsCard items={sections} hideFootnotes={isCompressed} />
}

export function VaultDetailsHeader({
  currentVault,
  isCollapsibleMode = true
}: {
  currentVault: TYDaemonVault
  isCollapsibleMode?: boolean
}): ReactElement {
  const { address } = useWeb3()
  const { getPrice } = useYearn()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const { decimals } = currentVault
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const { isCompressed } = useHeaderCompression({ enabled: isCollapsibleMode })
  const [vaultData, setVaultData] = useState<TVaultHoldingsData>({
    deposited: zeroNormalizedBN,
    valueInToken: zeroNormalizedBN,
    earnedAmount: zeroNormalizedBN,
    rewardTokenSymbol: '',
    rewardTokenDecimal: 0,
    earnedValue: 0
  })

  const tokenPrice = currentVault.tvl.price || 0

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

  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
    currentVault.chainID
  }/${currentVault.token.address.toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const explorerBase = getNetwork(currentVault.chainID).defaultBlockExplorer
  const explorerHref = explorerBase ? `${explorerBase}/address/${currentVault.address}` : ''
  const showChainChip = !isCompressed
  const showCategoryChip = Boolean(currentVault.category)
  const showKindChip = Boolean(currentVault.kind)
  const shouldShowMetadata = showChainChip || showCategoryChip || showKindChip
  const [isTitleClipped, setIsTitleClipped] = useState(false)
  const titleRef = useRef<HTMLSpanElement>(null)
  const vaultName = getVaultName(currentVault)

  useEffect(() => {
    // Preload chain logo so it appears instantly when the chip mounts
    const preload = new Image()
    preload.src = chainLogoSrc
  }, [chainLogoSrc])

  useEffect(() => {
    if (!isCompressed) {
      setIsTitleClipped(false)
      return
    }

    const measure = (): void => {
      if (!titleRef.current) return
      setIsTitleClipped(titleRef.current.scrollWidth > titleRef.current.clientWidth)
    }

    measure()
    window.addEventListener('resize', measure)

    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [isCompressed])

  return (
    <div className={'grid w-full grid-cols-1 gap-6 text-left md:auto-rows-min md:grid-cols-20 bg-app'}>
      <div className={'hidden md:flex items-center gap-2 text-sm text-text-secondary md:col-span-20 px-1'}>
        <Link to={'/'} className={'transition-colors hover:text-text-primary'}>
          {'Home'}
        </Link>
        <span>{'>'}</span>
        <Link to={'/v3'} className={'transition-colors hover:text-text-primary'}>
          {'Vaults'}
        </Link>
        <span>{'>'}</span>
        <span className={'font-medium text-text-primary'}>{getVaultName(currentVault)}</span>
      </div>
      <div
        className={cl(
          'flex flex-col gap-1 px-1',
          isCompressed ? 'md:col-span-5 md:row-start-2 md:justify-center' : 'md:col-span-20 md:row-start-2'
        )}
      >
        <div className={cl('flex items-center', isCompressed ? 'gap-2' : ' gap-4')}>
          <div
            className={cl(
              'relative flex items-center justify-start rounded-full bg-surface/70',
              isCompressed ? 'size-8' : 'size-10'
            )}
          >
            <TokenLogo
              src={tokenLogoSrc}
              tokenSymbol={currentVault.token.symbol || ''}
              width={isCompressed ? 32 : 40}
              height={isCompressed ? 32 : 40}
            />
            {isCompressed ? (
              <div
                className={
                  'absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-border bg-surface'
                }
              >
                <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={14} height={14} />
              </div>
            ) : null}
          </div>
          <div className={'flex flex-col'}>
            <div className={cl('flex items-center gap-3', isCompressed && isTitleClipped ? 'relative group' : '')}>
              <strong
                ref={titleRef}
                className={cl(
                  'text-lg font-black leading-tight md:text-3xl md:leading-10',
                  isDarkTheme ? 'text-text-primary' : 'text-text-secondary',
                  isCompressed ? 'md:text-[30px] md:leading-9 max-w-[260px] truncate whitespace-nowrap' : ''
                )}
              >
                {vaultName} {' yVault'}
              </strong>
              {isCompressed && isTitleClipped ? (
                <span
                  className={cl(
                    'pointer-events-none absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-app px-0 py-0 text-[30px] font-black leading-tight group-hover:block',
                    isDarkTheme ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {vaultName} {' yVault'}
                </span>
              ) : null}
              {!isCompressed && explorerHref ? (
                <a
                  href={explorerHref}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={'text-text-secondary hover:text-text-primary transition-colors h-7 content-end'}
                  aria-label={'View vault on block explorer'}
                >
                  <IconLinkOut className={'size-4 md:size-4'} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
        {shouldShowMetadata ? (
          <div className={'flex flex-wrap items-center gap-1 text-xs text-text-primary/70 md:text-xs mt-1'}>
            {showChainChip ? (
              <span
                className={
                  'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                }
              >
                <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={14} height={14} priority />
                <span>{chainName}</span>
              </span>
            ) : null}
            {showCategoryChip ? (
              <span
                className={
                  'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                }
              >
                {currentVault.category}
              </span>
            ) : null}
            {showKindChip ? (
              <span
                className={
                  'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                }
              >
                {currentVault.kind}
              </span>
            ) : null}
            {isCompressed && explorerHref ? (
              <a
                href={explorerHref}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'inline-flex items-center justify-center px-2 py-1 text-text-secondary hover:text-text-primary transition-colors'
                }
                aria-label={'View vault on block explorer'}
              >
                <IconLinkOut className={'size-4'} />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cl(isCompressed ? 'md:col-start-6 md:col-span-8 md:row-start-2' : 'md:col-span-13 md:row-start-3')}
      >
        <VaultOverviewCard currentVault={currentVault} isCompressed={isCompressed} />
      </div>
      <div
        className={cl(
          isCompressed ? 'md:col-span-7 md:col-start-14 md:row-start-2' : 'md:col-span-7 md:col-start-14 md:row-start-3'
        )}
      >
        <UserHoldingsCard
          currentVault={currentVault}
          vaultData={vaultData}
          tokenPrice={tokenPrice}
          isCompressed={isCompressed}
        />
      </div>
    </div>
  )
}
