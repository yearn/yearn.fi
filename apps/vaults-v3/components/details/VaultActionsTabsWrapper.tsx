import { InfoTooltip } from '@lib/components/InfoTooltip'
import { Switch } from '@lib/components/Switch'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TNormalizedBN } from '@lib/types'
import {
  cl,
  decodeAsBigInt,
  formatAmount,
  parseMarkdown,
  toAddress,
  toBigInt,
  toNormalizedBN,
  toNormalizedValue
} from '@lib/utils'
import { DISABLED_VEYFI_GAUGES_VAULTS_LIST, VEYFI_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { useUpdateEffect } from '@react-hookz/web'
import { Flow, useActionFlow } from '@vaults-v2/contexts/useActionFlow'
import { useVaultStakingData } from '@vaults-v2/hooks/useVaultStakingData'
import { STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/stakingRewards.abi'
import { VAULT_V3_ABI } from '@vaults-v2/utils/abi/vaultV3.abi'
import { VEYFI_ABI } from '@vaults-v2/utils/abi/veYFI.abi'
import { VaultDetailsQuickActionsButtons } from '@vaults-v3/components/details/actions/QuickActionsButtons'
import { VaultDetailsQuickActionsFrom } from '@vaults-v3/components/details/actions/QuickActionsFrom'
import { VaultDetailsQuickActionsSwitch } from '@vaults-v3/components/details/actions/QuickActionsSwitch'
import { VaultDetailsQuickActionsTo } from '@vaults-v3/components/details/actions/QuickActionsTo'
import { RewardsTab } from '@vaults-v3/components/details/RewardsTab'
import { SettingsPopover } from '@vaults-v3/components/SettingsPopover'
import { KATANA_CHAIN_ID } from '@vaults-v3/constants/addresses'
import type { ReactElement } from 'react'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useBlockNumber, useReadContract } from 'wagmi'
import { readContracts } from 'wagmi/actions'

/**************************************************************************************************
 ** Base type for tab options containing value, label and optional slug
 *************************************************************************************************/
type TTabsOptionsBase = {
  value: number
  label: string
  slug?: string
}

/**************************************************************************************************
 ** Extended tab options type that includes flow action
 *************************************************************************************************/
export type TTabsOptions = TTabsOptionsBase & {
  flowAction: Flow
}

/**************************************************************************************************
 ** Type for tab state management including selected index and setter function
 *************************************************************************************************/
export type TTabs = {
  selectedAboutTabIndex: number
  setSelectedAboutTabIndex: (arg0: number) => void
}

/**************************************************************************************************
 ** Available tabs for vault actions with their respective values, labels and flow actions
 *************************************************************************************************/
export const tabs: TTabsOptions[] = [
  { value: 0, label: 'Deposit', flowAction: Flow.Deposit, slug: 'deposit' },
  { value: 1, label: 'Withdraw', flowAction: Flow.Withdraw, slug: 'withdraw' },
  { value: 2, label: 'Migrate', flowAction: Flow.Migrate, slug: 'migrate' },
  { value: 3, label: 'Boost', flowAction: Flow.None, slug: 'boost' }
]

/**************************************************************************************************
 ** Determines the current tab based on deposit status, migration availability and retirement status
 ** Returns the withdraw tab if vault is migrated or retired, otherwise returns deposit/withdraw tab
 ** based on isDepositing flag
 *************************************************************************************************/
export function getCurrentTab(props: {
  isDepositing: boolean
  hasMigration: boolean
  isRetired: boolean
}): TTabsOptions {
  if (props.hasMigration || props.isRetired) {
    return tabs[1]
  }
  return tabs.find((tab): boolean => tab.value === (props.isDepositing ? 0 : 1)) as TTabsOptions
}

/**************************************************************************************************
 ** The BoostMessage component will display a message to the user if the current vault has staking
 ** rewards and the source of the rewards is either 'OP Boost' or 'VeYFI'. More source might be
 ** added in the future.
 ** An empty span will be returned if the current tab is not the 'Boost' tab or if no staking
 ** rewards are available.
 *************************************************************************************************/
export function BoostMessage(props: {
  currentVault: TYDaemonVault
  currentTab: number
  hasStakingRewardsLive: boolean
}): ReactElement {
  const { isAutoStakingEnabled } = useYearn()
  const hasStakingRewards = Boolean(props.currentVault.staking.available)
  const stakingRewardSource = props.currentVault.staking.source
  const extraAPY = props.currentVault.apr.extra.stakingRewardsAPR

  if (props.currentTab === 0 && hasStakingRewards && !props.hasStakingRewardsLive && stakingRewardSource !== 'VeYFI') {
    return <Fragment />
  }

  if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'OP Boost') {
    if (isAutoStakingEnabled) {
      return (
        <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
          <div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
            <b className={'text-base text-neutral-900'}>
              {
                'Great news! This Vault is receiving an Optimism Boost. Deposit and stake your tokens to receive OP rewards. Nice!'
              }
            </b>
          </div>
        </div>
      )
    }
    return (
      <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
        <div className={'w-full rounded-lg bg-[#F8A908] p-2 md:px-6 md:py-4'}>
          <b className={'text-base text-neutral-900'}>
            {
              "This Vault is receiving an Optimism Boost. To zap into it for additional OP rewards, you'll have to stake your yVault tokens manually on the $OP BOOST tab after you deposit. Sorry anon, it's just how it works."
            }
          </b>
        </div>
      </div>
    )
  }
  if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'VeYFI') {
    return (
      <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
        <div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
          <b className={'text-base text-neutral-900'}>
            {`This Vault has an active veYFI gauge which boosts your APY from ${formatAmount(extraAPY * 10)}% to ${formatAmount(extraAPY * 100)}% depending on the veYFI you have locked. Simply deposit and stake to start earning.`}
          </b>
          <b className={'block text-neutral-900'}>
            {'Learn more about veYFI rewards in the '}
            <a
              className={'underline'}
              href={'https://docs.yearn.fi/contributing/governance/veyfi-intro'}
              target={'_blank'}
              rel={'noreferrer'}
            >
              {'FAQ'}
            </a>
            {'.'}
          </b>
        </div>
      </div>
    )
  }
  if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'Juiced') {
    return (
      <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
        <div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
          <b className={'text-base text-neutral-900'}>
            {`This Vault can be juiced for even more yield. Simply deposit and stake to receive juiced APYs of ${formatAmount(extraAPY * 100)}%.`}
          </b>
          <b className={'block text-neutral-900'}>
            {'Visit '}
            <a className={'underline'} href={'https://juiced.app'} target={'_blank'} rel={'noreferrer'}>
              {'juiced.app'}
            </a>
            {' to learn more'}
          </b>
        </div>
      </div>
    )
  }
  if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'V3 Staking') {
    if (isAutoStakingEnabled) {
      return (
        <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
          <div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
            <b className={'text-base text-neutral-900'}>
              {
                'Great news! This Vault is receiving a Staking Boost. Deposit and stake your tokens to receive extra rewards. Nice!'
              }
            </b>
          </div>
        </div>
      )
    }
    return (
      <div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
        <div className={'w-full rounded-lg bg-[#F8A908] p-2 md:px-6 md:py-4'}>
          <b className={'text-base text-neutral-900'}>
            {
              "This Vault is receiving a Staking Boost. To zap into it for additional rewards, you'll have to stake your yVault tokens manually on the BOOST tab after you deposit. Sorry anon, it's just how it works."
            }
          </b>
        </div>
      </div>
    )
  }
  return <span />
}

/**************************************************************************************************
 ** The MobileTabButtons component will be used to display the tab buttons to navigate between the
 ** different tabs on mobile devices.
 *************************************************************************************************/
const MobileTabButtons = React.memo(function MobileTabButtons(props: {
  currentTab: TTabsOptions
  selectedTab: TTabsOptions
  setCurrentTab: (tab: TTabsOptions) => void
  onSwitchSelectedOptions: (flow: Flow) => void
}): ReactElement {
  const handleClick = useCallback(() => {
    props.setCurrentTab(props.currentTab)
    props.onSwitchSelectedOptions(props.currentTab.flowAction)
  }, [props])

  return (
    <button
      onClick={handleClick}
      className={cl(
        'flex h-10 pr-4 transition-all duration-300 flex-row items-center border-0 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden',
        props.selectedTab.value === props.currentTab.value
          ? 'border-b-2 border-neutral-900'
          : 'border-b-2 border-neutral-300'
      )}
    >
      {props.currentTab.label}
    </button>
  )
})

/**************************************************************************************************
 ** The Tab component will be used to display the tab buttons to navigate between the different
 ** actions available for the current vault.
 ** A special case exists when the current vault has staking rewards, because the name of the tab
 ** will be different depending on the source of the rewards.
 *************************************************************************************************/
export const VaultDetailsTab = React.memo(function VaultDetailsTab(props: {
  currentVault: TYDaemonVault
  tab: TTabsOptions
  selectedTab: TTabsOptions
  unstakedBalance: TNormalizedBN | undefined
  onSwitchTab: (tab: TTabsOptions) => void
}): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isV3Page = location.pathname.startsWith('/v3')
  const stakingRewardSource = props.currentVault.staking.source
  const tabLabel = useMemo(() => {
    if (props.tab.label === 'Boost' && stakingRewardSource === 'VeYFI') {
      return 'veYFI BOOST'
    }
    if (props.tab.label === 'Boost' && stakingRewardSource === 'OP Boost') {
      return '$OP BOOST'
    }
    if (props.tab.label === 'Boost' && stakingRewardSource === 'Juiced') {
      return 'Juiced BOOST'
    }
    if (props.tab.label === 'Boost' && stakingRewardSource === 'V3 Staking') {
      return 'Staking BOOST'
    }
    return props.tab.label
  }, [props.tab.label, stakingRewardSource])

  const handleClick = useCallback((): void => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('action', props.tab.slug || '')
    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true })
    props.onSwitchTab(props.tab)
  }, [searchParams, props.tab, location.pathname, navigate, props.onSwitchTab])

  return (
    <button key={`desktop-${props.tab.value}`} onClick={handleClick}>
      <p
        title={tabLabel}
        aria-selected={props.selectedTab.value === props.tab.value}
        className={cl(
          'hover-fix tab relative',
          isV3Page
            ? props.selectedTab.value === props.tab.value
              ? 'text-neutral-900!'
              : 'text-neutral-900/50! hover:text-neutral-900!'
            : ''
        )}
      >
        {tabLabel}
        {props.tab.label === 'Boost' && toBigInt(props.unstakedBalance?.raw) > 0n ? (
          <span className={'absolute -right-3 -top-1 z-10 flex size-2.5'}>
            <span className={'absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75'} />
            <span className={'relative inline-flex size-2.5 rounded-full bg-primary'} />
          </span>
        ) : null}
      </p>
    </button>
  )
})

/**************************************************************************************************
 ** The VaultActionsTabsWrapper wraps the different components that are part of the Vault Actions
 ** section. It will display the different tabs available for the current vault and the
 ** corresponding actions that can be taken.
 *************************************************************************************************/
function VaultActionsTabsWrapperComponent({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { onSwitchSelectedOptions, isDepositing, actionParams, veYFIBalance, hasVeYFIBalance } = useActionFlow()
  const { address } = useWeb3()
  const { onRefresh } = useWallet()
  const [searchParams] = useSearchParams()
  const { isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()
  const { vaultData, updateVaultData } = useVaultStakingData({ currentVault })
  const [unstakedBalance, setUnstakedBalance] = useState<TNormalizedBN | undefined>(undefined)
  const [possibleTabs, setPossibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]])
  const [hasStakingRewardsLive, setHasStakingRewardsLive] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTab, setCurrentTab] = useState<TTabsOptions>(
    getCurrentTab({
      isDepositing,
      hasMigration: currentVault?.migration?.available,
      isRetired: currentVault?.info?.isRetired
    })
  )
  const hasStakingRewards = Boolean(currentVault.staking.available)

  const shouldForceDisplayBoostTab = !!DISABLED_VEYFI_GAUGES_VAULTS_LIST.find(
    (vault) => vault.address === currentVault.address
  )

  const isSourceVeYFI = currentVault.staking.source === 'VeYFI'

  /**********************************************************************************************
   ** Retrieve some data for correct display of APR
   **********************************************************************************************/
  const { data: veYFITotalSupplyData } = useReadContract({
    address: toAddress(VEYFI_ADDRESS),
    abi: VEYFI_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: isSourceVeYFI && isAutoStakingEnabled && hasVeYFIBalance
    }
  })

  const veYFITotalSupply = veYFITotalSupplyData ? toNormalizedValue(veYFITotalSupplyData as bigint, 18) : 0
  const { data: gaugeTotalSupplyData } = useReadContract({
    address: currentVault.staking.address,
    abi: VAULT_V3_ABI,
    functionName: 'totalAssets',
    query: {
      enabled: isSourceVeYFI && isAutoStakingEnabled && hasVeYFIBalance
    }
  })
  const gaugeTotalSupply = gaugeTotalSupplyData ? toNormalizedValue(gaugeTotalSupplyData as bigint, 18) : 0

  const stakingSource = currentVault.staking.source
  const getTabLabel = useCallback((): string => {
    if (stakingSource === 'VeYFI') {
      return 'veYFI BOOST'
    }
    if (stakingSource === 'OP Boost') {
      return '$OP BOOST'
    }
    if (stakingSource === 'Juiced') {
      return 'Juiced BOOST'
    }
    if (stakingSource === 'V3 Staking') {
      return 'Staking BOOST'
    }
    if (stakingSource === 'yBOLD') {
      return 'yBOLD Staking'
    }
    return 'Staking'
  }, [stakingSource])

  const { data: blockNumber } = useBlockNumber({ watch: true })

  const lastRefetchTime = useRef(0)
  const REFETCH_DEBOUNCE_TIME = 5000 // 5 seconds debounce

  /**********************************************************************************************
   ** Retrieve some data from the vault and the staking contract to display a comprehensive view
   ** of the user's holdings in the vault.
   **********************************************************************************************/
  const refetch = useAsyncTrigger(async (): Promise<void> => {
    if (!currentVault.staking.available) {
      return
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
          abi: STAKING_REWARDS_ABI,
          chainId: currentVault.chainID,
          functionName: 'periodFinish',
          args: []
        }
      ]
    })

    const hasLiveRewards = decodeAsBigInt(result[1]) > Math.floor(Date.now() / 1000)
    setUnstakedBalance(toNormalizedBN(decodeAsBigInt(result[0]), currentVault.decimals))
    setHasStakingRewardsLive(hasLiveRewards)
  }, [currentVault, address])
  /**********************************************************************************************
   ** As we want live data, we want the data to be refreshed every time the block number changes.
   ** This way, the user will always have the most up-to-date data.
   ** For Base chain (8453), we limit updates to reduce RPC calls and prevent rate limiting.
   ** We also implement debouncing to avoid too frequent updates.
   **********************************************************************************************/
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastRefetch = now - lastRefetchTime.current

    if (timeSinceLastRefetch < REFETCH_DEBOUNCE_TIME) {
      return
    }

    if (currentVault.chainID === 8453) {
      if (blockNumber && Number(blockNumber) % 10 === 0) {
        lastRefetchTime.current = now
        refetch()
      }
    } else {
      lastRefetchTime.current = now
      refetch()
    }
  }, [blockNumber, refetch, currentVault.chainID])

  /**********************************************************************************************
   ** Update the current state based on the query parameter action. This will allow the user to
   ** navigate between the different tabs by changing the URL, or directly access a specific tab
   ** based on the URL.
   *********************************************************************************************/
  useEffect((): void => {
    const actionParam = searchParams.get('action')
    const tab = tabs.find((tab): boolean => tab.slug === actionParam)
    if (tab?.value) {
      setCurrentTab(tab)
    }
  }, [searchParams])

  /**********************************************************************************************
   ** UpdateEffect to define which tabs are available based on the current state of the vault.
   ** - If the vault has been migrated, only the withdraw and migrate tabs will be available,
   ** with the focus set on the migrate tab.
   ** - If the vault is retired, only the withdraw tab will be available.
   ** - If the vault has staking rewards, the deposit, withdraw, and boost tabs will be
   ** available.
   ** - Otherwise we keep the default, aka deposit and withdraw tabs.
   *********************************************************************************************/
  useUpdateEffect((): void => {
    if (currentVault?.migration?.available && actionParams.isReady) {
      const tabsToDisplay = [tabs[1], tabs[2]]
      if (hasStakingRewards) {
        tabsToDisplay.push(tabs[3])
      }
      setPossibleTabs(tabsToDisplay)
      setCurrentTab(tabs[2])
      onSwitchSelectedOptions(Flow.Migrate)
    } else if (currentVault?.info?.isRetired && actionParams.isReady) {
      const tabsToDisplay = [tabs[1]]
      if (hasStakingRewards) {
        tabsToDisplay.push(tabs[3])
      }
      setPossibleTabs(tabsToDisplay)
      setCurrentTab(tabs[1])
      onSwitchSelectedOptions(Flow.Withdraw)
    } else if (hasStakingRewards) {
      setPossibleTabs([tabs[0], tabs[1], tabs[3]])
    } else {
      setPossibleTabs([tabs[0], tabs[1]])
    }
  }, [currentVault?.migration?.available, currentVault?.info?.isRetired, actionParams.isReady, hasStakingRewards])

  const hasStakingRewardsEndedOverAWeekAgo = useMemo(() => {
    return currentVault.staking.rewards?.some(
      (el) => Math.floor(Date.now() / 1000) - (el.finishedAt ?? 0) > 60 * 60 * 24 * 7
    )
  }, [currentVault.staking.rewards])

  /************************************************************************************************
   * This effect manages the auto-staking feature based on staking rewards availability.
   * It disables auto-staking if there are no staking rewards and the last reward ended over a week ago.
   * Otherwise, it enables auto-staking.
   *
   * The check for rewards ending over a week ago helps prevent unnecessary auto-staking
   * for vaults with expired or long-inactive staking programs.
   ************************************************************************************************/
  useEffect(() => {
    if (!hasStakingRewards && hasStakingRewardsEndedOverAWeekAgo) {
      setIsAutoStakingEnabled(false)
      return
    }
    setIsAutoStakingEnabled(true)
  }, [hasStakingRewardsEndedOverAWeekAgo, hasStakingRewards, setIsAutoStakingEnabled])

  const isSonneRetiredVault = useMemo(
    () =>
      toAddress(currentVault.address) === toAddress('0x5b977577eb8a480f63e11fc615d6753adb8652ae') ||
      toAddress(currentVault.address) === toAddress('0xad17a225074191d5c8a37b50fda1ae278a2ee6a2') ||
      toAddress(currentVault.address) === toAddress('0x65343f414ffd6c97b0f6add33d16f6845ac22bac') ||
      toAddress(currentVault.address) === toAddress('0xfaee21d0f0af88ee72bb6d68e54a90e6ec2616de'),
    [currentVault.address]
  )

  const tooltipText = useMemo(() => {
    if (isAutoStakingEnabled) {
      return 'Deposit your tokens and automatically stake them to earn additional rewards.'
    }
    return 'Deposit your tokens without automatically staking them for additional rewards.'
  }, [isAutoStakingEnabled])

  return (
    <>
      {currentVault?.chainID === KATANA_CHAIN_ID && (
        <div aria-label={'Rewards Claim Notification'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <div>
              <b>{'Bridge to Katana at: '}</b>
              <a className={'underline'} href={'https://bridge.katana.network/'} target={'_blank'} rel={'noreferrer'}>
                {'https://bridge.katana.network/'}
              </a>
            </div>
            <div>
              <b>{'KAT Rewards earned by Katana Vaults can be claimed at: '}</b>
              <a className={'underline'} href={'https://katana.yearn.space'} target={'_blank'} rel={'noreferrer'}>
                {'https://katana.yearn.space'}
              </a>
            </div>
          </div>
        </div>
      )}

      {currentVault?.migration?.available && (
        <div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <b className={'text-lg'}>{'Looks like this is an old vault.'}</b>
            <p className={'mt-2'}>
              {
                'This Vault has been retired, but there is a migration path to a new Vault that is ready to earn yield for you. Please migrate or withdraw your assets.'
              }
            </p>
          </div>
        </div>
      )}

      {!currentVault?.migration.available &&
        currentVault?.info?.isRetired &&
        !currentVault.info.uiNotice &&
        !isSonneRetiredVault && (
          <div aria-label={'Deprecation Warning'} className={'col-span-12 mt-10'}>
            <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
              <b className={'text-lg'}>{'This Vault is no longer supported (oh no).'}</b>
              <p className={'mt-2'}>
                {
                  'They say all good things must come to an end, and sadly this vault is deprecated and will no longer earn yield or be supported by Yearn. Please withdraw your funds (which you could deposit into another Vault. Just saying…)'
                }
              </p>
            </div>
          </div>
        )}

      {currentVault?.info.uiNotice && !currentVault?.migration.available && currentVault.info.isRetired && (
        <div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <b className={'text-lg'}>{'Looks like this is an old vault.'}</b>
            <p
              className={'mt-2'}
              dangerouslySetInnerHTML={{
                __html: parseMarkdown(currentVault?.info.uiNotice.replaceAll('{{token}}', currentVault.token.symbol))
              }}
            />
          </div>
        </div>
      )}

      {currentVault?.info.uiNotice &&
        !currentVault?.migration.available &&
        !currentVault.info.isRetired &&
        !isSonneRetiredVault && (
          <div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
            <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
              <p
                className={'mt-2'}
                dangerouslySetInnerHTML={{
                  __html: parseMarkdown(currentVault?.info.uiNotice.replaceAll('{{token}}', currentVault.token.symbol))
                }}
              />
            </div>
          </div>
        )}

      <div className={'col-span-12 mt-6 flex flex-col rounded-3xl bg-neutral-100'}>
        <div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
          <nav className={'hidden flex-row items-center space-x-10 md:flex'}>
            {(possibleTabs as TTabsOptions[])
              .filter((tab) => tab.value !== 3)
              .map(
                (tab): ReactElement => (
                  <VaultDetailsTab
                    currentVault={currentVault}
                    key={tab.value}
                    tab={tab}
                    selectedTab={currentTab}
                    unstakedBalance={unstakedBalance}
                    onSwitchTab={(newTab) => {
                      setCurrentTab(newTab)
                      onSwitchSelectedOptions(newTab.flowAction)
                    }}
                  />
                )
              )}
          </nav>
          <div className={'relative z-50'}>
            <div className={'flex gap-4'}>
              <MobileTabButtons
                currentTab={tabs[0]}
                selectedTab={currentTab}
                setCurrentTab={setCurrentTab}
                onSwitchSelectedOptions={onSwitchSelectedOptions}
              />
              <MobileTabButtons
                currentTab={tabs[1]}
                selectedTab={currentTab}
                setCurrentTab={setCurrentTab}
                onSwitchSelectedOptions={onSwitchSelectedOptions}
              />
            </div>
          </div>

          <div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
            <button
              onClick={async () => {
                setIsRefreshing(true)
                const { chainID } = currentVault
                const toRefresh = [
                  { address: toAddress(actionParams?.selectedOptionFrom?.value), chainID },
                  { address: toAddress(actionParams?.selectedOptionTo?.value), chainID },
                  { address: toAddress(currentVault.address), chainID }
                ]
                await onRefresh(toRefresh)
                setIsRefreshing(false)
              }}
              className={cl(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 border font-medium',
                isRefreshing 
                  ? 'bg-neutral-200 border-neutral-300 text-neutral-500 cursor-not-allowed' 
                  : 'bg-yearn-blue border-yearn-blue hover:bg-yearn-blue/90 text-white hover:shadow-lg'
              )}
              title="Refresh token balances"
              disabled={isRefreshing}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={cl('w-4 h-4', isRefreshing ? 'animate-spin' : '')}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="hidden md:inline">Refresh</span>
            </button>
            <SettingsPopover vault={currentVault} />
          </div>
        </div>
        <div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

        {currentTab.value === 3 ? (
          <RewardsTab
            currentVault={currentVault}
            hasStakingRewardsLive={hasStakingRewardsLive}
            vaultData={vaultData}
            updateVaultData={updateVaultData}
          />
        ) : (
          <div
            className={
              'col-span-12 flex flex-col space-x-0 space-y-2 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-10'
            }
          >
            <VaultDetailsQuickActionsFrom
              currentVault={currentVault}
              vaultData={vaultData}
              veYFIBalance={veYFIBalance}
              veYFITotalSupply={veYFITotalSupply}
              gaugeTotalSupply={gaugeTotalSupply}
            />
            <VaultDetailsQuickActionsSwitch />
            <VaultDetailsQuickActionsTo
              vaultData={vaultData}
              veYFIBalance={veYFIBalance}
              veYFITotalSupply={veYFITotalSupply}
              gaugeTotalSupply={gaugeTotalSupply}
            />
            <div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
              <div>
                {hasStakingRewardsLive && isDepositing ? (
                  <div className={cl('mt-1 flex justify-between pb-[10px]')}>
                    <div className={'flex items-center gap-5'}>
                      <InfoTooltip className={'max-sm:left'} text={tooltipText} size={'sm'} />
                      <p className={cl('text-xs text-neutral-600')}>
                        {isAutoStakingEnabled ? 'Deposit and Stake' : 'Deposit only'}
                      </p>
                    </div>

                    <Switch
                      isEnabled={isAutoStakingEnabled}
                      onSwitch={(): void => setIsAutoStakingEnabled(!isAutoStakingEnabled)}
                    />
                  </div>
                ) : (
                  <div className={'h-8'} />
                )}
                <VaultDetailsQuickActionsButtons
                  currentVault={currentVault}
                  hasStakingRewardsLive={hasStakingRewardsLive}
                />
              </div>
            </div>
          </div>
        )}
        {(currentTab.value !== 3 && currentVault.staking.rewards) || shouldForceDisplayBoostTab ? (
          <Fragment>
            <div className={'flex flex-row items-center justify-between pl-4 md:px-8'}>
              <div
                className={cl(
                  'flex h-10 min-w-28 z-10 flex-row items-center bg-neutral-100 p-0 font-bold md:hidden border-b-2 border-neutral-900'
                )}
              >
                {'Boost'}
              </div>
              <div className={'hidden border-b-2 border-neutral-900 pb-4 font-bold md:block'}>{getTabLabel()}</div>
            </div>
            <div>
              <div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />
              <RewardsTab
                currentVault={currentVault}
                hasStakingRewardsLive={hasStakingRewardsLive}
                vaultData={vaultData}
                updateVaultData={updateVaultData}
              />
            </div>
          </Fragment>
        ) : null}
      </div>
    </>
  )
}

export const VaultActionsTabsWrapper = React.memo(VaultActionsTabsWrapperComponent)
