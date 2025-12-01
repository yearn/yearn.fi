import Link from '@components/Link'
import { InfoTooltip } from '@lib/components/InfoTooltip'
import { Switch } from '@lib/components/Switch'
import { useYearn } from '@lib/contexts/useYearn'
import type { TNormalizedBN } from '@lib/types'
import { cl, toAddress, toNormalizedValue } from '@lib/utils'
import { DISABLED_VEYFI_GAUGES_VAULTS_LIST, VEYFI_ADDRESS } from '@lib/utils/constants'
import { parseMarkdown } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useUpdateEffect } from '@react-hookz/web'
import { SettingsPopover } from '@vaults-v2/components/SettingsPopover'
import { Flow, useActionFlow } from '@vaults-v2/contexts/useActionFlow'
import { useVaultStakingData } from '@vaults-v2/hooks/useVaultStakingData'
import { VAULT_V3_ABI } from '@vaults-v2/utils/abi/vaultV3.abi'
import { VEYFI_ABI } from '@vaults-v2/utils/abi/veYFI.abi'
import { VaultDetailsQuickActionsButtons } from '@vaults-v3/components/details/actions/QuickActionsButtons'
import { VaultDetailsQuickActionsFrom } from '@vaults-v3/components/details/actions/QuickActionsFrom'
import { VaultDetailsQuickActionsSwitch } from '@vaults-v3/components/details/actions/QuickActionsSwitch'
import { VaultDetailsQuickActionsTo } from '@vaults-v3/components/details/actions/QuickActionsTo'
import { RewardsTab } from '@vaults-v3/components/details/RewardsTab'
import type { TTabsOptions } from '@vaults-v3/components/details/VaultActionsTabsWrapper'
import { getCurrentTab, tabs, VaultDetailsTab } from '@vaults-v3/components/details/VaultActionsTabsWrapper'
import type { ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useReadContract } from 'wagmi'

/**************************************************************************************************
 ** The MobileTabButtons component will be used to display the tab buttons to navigate between the
 ** different tabs on mobile devices.
 *************************************************************************************************/
function MobileTabButtons(props: {
  currentTab: TTabsOptions
  selectedTab: TTabsOptions
  setCurrentTab: (tab: TTabsOptions) => void
  onSwitchSelectedOptions: (flow: Flow) => void
}): ReactElement {
  return (
    <button
      onClick={() => {
        props.setCurrentTab(props.currentTab)
        props.onSwitchSelectedOptions(props.currentTab.flowAction)
      }}
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
}

/**************************************************************************************************
 ** The VaultActionsTabsWrapper wraps the different components that are part of the Vault Actions
 ** section. It will display the different tabs available for the current vault and the
 ** corresponding actions that can be taken.
 *************************************************************************************************/
export function VaultActionsTabsWrapper({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const [searchParams] = useSearchParams()
  const { isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()
  const { vaultData, updateVaultData } = useVaultStakingData({ currentVault })
  const { onSwitchSelectedOptions, isDepositing, actionParams, hasVeYFIBalance, veYFIBalance } = useActionFlow()
  const [possibleTabs, setPossibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]])
  const [unstakedBalance, setUnstakedBalance] = useState<TNormalizedBN | undefined>(undefined)
  const [currentTab, setCurrentTab] = useState<TTabsOptions>(
    getCurrentTab({
      isDepositing,
      hasMigration: currentVault?.migration?.available,
      isRetired: currentVault?.info?.isRetired
    })
  )
  const hasStakingRewards = Boolean(currentVault.staking.available)
  const hasActiveRewardsProgram = useMemo((): boolean => {
    return (currentVault.staking.rewards || []).some((reward) => !reward.isFinished)
  }, [currentVault.staking.rewards])
  const stakingSource = currentVault.staking.source
  const isVeYFIGauge = stakingSource === 'VeYFI'
  const isGaugeDisabled = isVeYFIGauge
    ? !!DISABLED_VEYFI_GAUGES_VAULTS_LIST.find((vault) => vault.address === currentVault.address)
    : false
  const isGaugeActive = currentVault.staking.available && (isVeYFIGauge ? !isGaugeDisabled : hasActiveRewardsProgram)
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

  const userHasStakedDeposit = vaultData.stakedBalanceOf.raw > 0n
  const userHasClaimableRewards = vaultData.stakedEarned.raw > 0n
  const canShowVeYFIRewards = !isVeYFIGauge ? true : userHasStakedDeposit || userHasClaimableRewards

  useEffect(() => {
    setUnstakedBalance(vaultData.vaultBalanceOf)
  }, [vaultData.vaultBalanceOf])

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

  useEffect(() => {
    if (currentTab.value === 3 && isVeYFIGauge && !canShowVeYFIRewards) {
      setCurrentTab(tabs[0])
      onSwitchSelectedOptions(Flow.Deposit)
    }
  }, [currentTab.value, isVeYFIGauge, canShowVeYFIRewards, onSwitchSelectedOptions])

  /************************************************************************************************
   * This effect manages the auto-staking feature based on staking rewards availability.
   * It disables auto-staking if there are no staking rewards and the last reward ended over a week ago.
   * Otherwise, it enables auto-staking.
   *
   * The check for rewards ending over a week ago helps prevent unnecessary auto-staking
   * for vaults with expired or long-inactive staking programs.
   ************************************************************************************************/
  useEffect(() => {
    const hasStakingRewardsEndedOverAWeekAgo = currentVault.staking.rewards?.some(
      (el) => Math.floor(Date.now() / 1000) - (el.finishedAt ?? 0) > 60 * 60 * 24 * 7
    )
    if (!isGaugeActive) {
      setIsAutoStakingEnabled(false)
      return
    }
    if (!hasStakingRewards && hasStakingRewardsEndedOverAWeekAgo) {
      setIsAutoStakingEnabled(false)
      return
    }
    setIsAutoStakingEnabled(true)
  }, [currentVault.staking.rewards, hasStakingRewards, isGaugeActive, setIsAutoStakingEnabled])

  const isSonneRetiredVault =
    toAddress(currentVault.address) === toAddress('0x5b977577eb8a480f63e11fc615d6753adb8652ae') ||
    toAddress(currentVault.address) === toAddress('0xad17a225074191d5c8a37b50fda1ae278a2ee6a2') ||
    toAddress(currentVault.address) === toAddress('0x65343f414ffd6c97b0f6add33d16f6845ac22bac') ||
    toAddress(currentVault.address) === toAddress('0xfaee21d0f0af88ee72bb6d68e54a90e6ec2616de')

  const getTabLabel = useCallback((): string => {
    if (currentVault.staking.source === 'VeYFI') {
      return 'veYFI BOOST'
    }
    if (currentVault.staking.source === 'OP Boost') {
      return '$OP BOOST'
    }
    if (currentVault.staking.source === 'Juiced') {
      return 'Juiced BOOST'
    }
    if (currentVault.staking.source === 'V3 Staking') {
      return 'Staking BOOST'
    }
    return 'Staking'
  }, [currentVault.staking.source])

  const tooltipText = useMemo(() => {
    if (isAutoStakingEnabled) {
      return 'Deposit your tokens and automatically stake them to earn additional rewards.'
    }
    return 'Deposit your tokens without automatically staking them for additional rewards.'
  }, [isAutoStakingEnabled])

  return (
    <>
      {currentVault?.migration?.available && (
        <div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <b className={'text-lg'}>{'Looks like this is an old vault.'}</b>
            <p className={'mt-2'}>
              {
                'This Vault is no longer earning yield, but good news, there’s a shiny up to date version just waiting for you to deposit your tokens into. Click migrate, and your tokens will be migrated to the current Vault, which will be mi-great!'
              }
            </p>
          </div>
        </div>
      )}

      {!currentVault?.migration.available && currentVault?.info?.isRetired && !isSonneRetiredVault && (
        <div aria-label={'Deprecation Warning'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <b className={'text-lg'}>{'This Vault is no longer supported (oh no).'}</b>
            <p className={'mt-2'}>
              {
                'This Vault has been retired and is no longer supported. Please withdraw your funds at your earliest convenience. If you have any questions, feel free to reach out to our support team for assistance.'
              }
            </p>
          </div>
        </div>
      )}

      {currentVault?.info.uiNotice && (
        <div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
          <div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
            <b className={'text-lg'}>{'Oh look, an important message for you to read!'}</b>
            <p
              className={'mt-2'}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled vault config content, not user input
              dangerouslySetInnerHTML={{
                __html: parseMarkdown(currentVault?.info.uiNotice.replaceAll('{{token}}', currentVault.token.symbol))
              }}
            />
          </div>
        </div>
      )}

      <nav
        className={cl(
          'mb-2 w-full',
          currentVault?.info?.isRetired
            ? 'mt-1 md:mt-4'
            : currentVault?.info.uiNotice
              ? 'mt-10 md:mt-10'
              : 'mt-10 md:mt-20'
        )}
      >
        <Link href={'/vaults'}>
          <p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>{'Back to vaults'}</p>
        </Link>
      </nav>

      <div className={'col-span-12 mb-4 flex flex-col rounded-3xl bg-neutral-100 py-2'}>
        <div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
          <nav className={'hidden flex-row items-center space-x-10 md:flex'}>
            {possibleTabs
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
            <SettingsPopover vault={currentVault} />
          </div>
        </div>
        <div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

        {currentTab.value === 3 ? (
          !isVeYFIGauge || canShowVeYFIRewards ? (
            <RewardsTab
              currentVault={currentVault}
              vaultData={vaultData}
              updateVaultData={updateVaultData}
              isGaugeActive={isGaugeActive}
            />
          ) : null
        ) : (
          <div
            className={
              'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-6'
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
                {isGaugeActive && isDepositing ? (
                  <div className={cl('mt-1 flex justify-between pb-[10px]')}>
                    <div className={'flex items-center gap-5'}>
                      <InfoTooltip
                        iconClassName={!hasVeYFIBalance ? 'opacity-40' : ''}
                        className={'max-sm:left-1'}
                        text={tooltipText}
                        size={'sm'}
                      />
                      <p className={'text-xs text-neutral-600'}>
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
                <VaultDetailsQuickActionsButtons currentVault={currentVault} isGaugeActive={isGaugeActive} />
              </div>
            </div>
          </div>
        )}
        {currentTab.value !== 3 && currentVault.staking.rewards && (!isVeYFIGauge || canShowVeYFIRewards) && (
          <Fragment>
            <div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
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
                vaultData={vaultData}
                updateVaultData={updateVaultData}
                isGaugeActive={isGaugeActive}
              />
            </div>
          </Fragment>
        )}
      </div>
    </>
  )
}
