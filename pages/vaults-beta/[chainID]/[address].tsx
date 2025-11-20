import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { cl, toAddress } from '@lib/utils'
import { IconChevron } from '@lib/icons/IconChevron'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultAboutSection } from '@nextgen/components/vaults-beta/VaultAboutSection'
import { VaultChartsSection } from '@nextgen/components/vaults-beta/VaultChartsSection'
import { VaultDetailsHeader } from '@nextgen/components/vaults-beta/VaultDetailsHeader'
import { VaultInfoSection } from '@nextgen/components/vaults-beta/VaultInfoSection'
import { VaultRiskSection } from '@nextgen/components/vaults-beta/VaultRiskSection'
import { VaultStrategiesSection } from '@nextgen/components/vaults-beta/VaultStrategiesSection'
import { Widget } from '@nextgen/components/widget'
import { WidgetActionType } from '@nextgen/types'
import { fetchYBoldVault } from '@vaults-v3/utils/handleYBold'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

function Index(): ReactElement | null {
  const { address, isActive } = useWeb3()
  const params = useParams()
  const chainId = Number(params.chainID)
  const { onRefresh } = useWallet()
  const { yDaemonBaseUri } = useYDaemonBaseURI({
    chainID: chainId
  })

  // Use vault address as key to reset state
  const vaultKey = `${params.chainID}-${params.address}`
  const [_currentVault, setCurrentVault] = useState<TYDaemonVault | undefined>(undefined)
  const [isInit, setIsInit] = useState(false)
  const [overrideVault, setOverrideVault] = useState<TYDaemonVault | undefined>(undefined)
  const [hasFetchedOverride, setHasFetchedOverride] = useState(false)
  const [lastVaultKey, setLastVaultKey] = useState(vaultKey)
  const [openSections, setOpenSections] = useState<Record<'about' | 'risk' | 'strategies' | 'info', boolean>>({
    about: true,
    risk: true,
    strategies: true,
    info: true
  })
  const collapsibleTitles: Record<'about' | 'risk' | 'strategies' | 'info', string> = {
    about: 'Description',
    risk: 'Risk',
    strategies: 'Strategies',
    info: 'More Info'
  }

  // Reset state when vault changes
  useEffect(() => {
    if (vaultKey !== lastVaultKey) {
      setCurrentVault(undefined)
      setOverrideVault(undefined)
      setHasFetchedOverride(false)
      setIsInit(false)
      setLastVaultKey(vaultKey)
    }
  }, [vaultKey, lastVaultKey])

  // Create a stable endpoint that includes the vault key to force SWR to refetch
  const endpoint = useMemo(() => {
    if (!params.address || !yDaemonBaseUri) return null
    return `${yDaemonBaseUri}/vaults/${toAddress(params.address as string)}?${new URLSearchParams({
      strategiesDetails: 'withDetails',
      strategiesCondition: 'inQueue'
    })}`
  }, [params.address, yDaemonBaseUri])

  const {
    data: vault,
    isLoading: isLoadingVault,
    mutate
  } = useFetch<TYDaemonVault>({
    endpoint,
    schema: yDaemonVaultSchema,
    config: {
      // Force re-fetch when vault key changes
      revalidateOnMount: true,
      keepPreviousData: false,
      dedupingInterval: 0 // Disable deduping to ensure fresh fetch
    }
  })

  // Force refetch when endpoint changes
  useEffect(() => {
    if (endpoint) {
      mutate()
    }
  }, [endpoint, mutate])

  // TODO: remove this workaround when possible
  // <WORKAROUND>
  const currentVault = useMemo(() => {
    if (overrideVault) return overrideVault
    if (_currentVault) return _currentVault
    return undefined
  }, [overrideVault, _currentVault])

  const isV3 = currentVault?.version.startsWith('3') || currentVault?.version.startsWith('~3')

  useEffect(() => {
    if (!hasFetchedOverride && _currentVault && _currentVault.address) {
      setHasFetchedOverride(true)
      fetchYBoldVault(yDaemonBaseUri, _currentVault).then((_vault) => {
        if (_vault) {
          setOverrideVault(_vault)
        }
      })
    }
  }, [yDaemonBaseUri, _currentVault, hasFetchedOverride])
  // </WORKAROUND>

  useEffect((): void => {
    if (vault && (!_currentVault || vault.address !== _currentVault.address)) {
      setCurrentVault(vault)
      setIsInit(true)
    }
  }, [vault, _currentVault])

  useEffect((): void => {
    if (address && isActive) {
      const tokensToRefresh: TUseBalancesTokens[] = []
      if (currentVault?.address) {
        tokensToRefresh.push({
          address: currentVault.address,
          chainID: currentVault.chainID
        })
      }
      if (currentVault?.token?.address) {
        tokensToRefresh.push({
          address: currentVault.token.address,
          chainID: currentVault.chainID
        })
      }
      if (currentVault?.staking.available) {
        tokensToRefresh.push({
          address: currentVault.staking.address,
          chainID: currentVault.chainID
        })
      }
      onRefresh(tokensToRefresh)
    }
  }, [
    currentVault?.address,
    currentVault?.token.address,
    address,
    isActive,
    onRefresh,
    currentVault?.chainID,
    currentVault?.staking.available,
    currentVault?.staking.address
  ])

  if (isLoadingVault || !params.address || !isInit || !yDaemonBaseUri) {
    return (
      <div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
        <div className={'mt-[20%] flex h-10 items-center justify-center'}>
          <span className={'loader'} />
        </div>
      </div>
    )
  }

  if (!currentVault) {
    return (
      <div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
        <div className={'mt-[20%] flex h-10 items-center justify-center'}>
          <p className={'text-sm text-neutral-900'}>{"We couldn't find this vault on the connected network."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={'vaults-layout vaults-layout--detail'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header
          className={cl(
            'h-full rounded-3xl',
            'relative flex flex-col items-center justify-center',
            'md:sticky md:z-30'
          )}
          style={{ top: 'var(--header-height)' }}
        >
          <VaultDetailsHeader currentVault={currentVault} />
        </header>

        <section className={'mt-6 grid grid-cols-1 gap-6 md:grid-cols-20 md:items-start'}>
          <div className={'space-y-4 md:col-span-13 pb-4'}>
            {[
              {
                key: 'charts',
                shouldRender: Number.isInteger(chainId),
                content: <VaultChartsSection chainId={chainId} vaultAddress={currentVault.address} />
              },
              {
                key: 'about',
                shouldRender: true,
                content: <VaultAboutSection currentVault={currentVault} />
              },
              {
                key: 'risk',
                shouldRender: true,
                content: <VaultRiskSection currentVault={currentVault} />
              },
              {
                key: 'strategies',
                shouldRender: Number(currentVault.strategies?.length || 0) > 0,
                content: <VaultStrategiesSection currentVault={currentVault} />
              },
              {
                key: 'info',
                shouldRender: true,
                content: <VaultInfoSection currentVault={currentVault} yDaemonBaseUri={yDaemonBaseUri} />
              }
            ]
              .filter((section) => section.shouldRender)
              .map((section) => {
                const isCollapsible =
                  section.key === 'about' ||
                  section.key === 'risk' ||
                  section.key === 'strategies' ||
                  section.key === 'info'
                if (isCollapsible) {
                  const typedKey = section.key as 'about' | 'risk' | 'strategies' | 'info'
                  const isOpen = openSections[typedKey]

                  return (
                    <div key={section.key} className={'border border-neutral-300 rounded-lg bg-surface'}>
                      <button
                        type={'button'}
                        className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}
                        onClick={(): void =>
                          setOpenSections((previous) => ({ ...previous, [typedKey]: !previous[typedKey] }))
                        }
                      >
                        <span className={'text-base font-semibold text-neutral-900'}>
                          {collapsibleTitles[typedKey]}
                        </span>
                        <IconChevron
                          className={'size-4 text-neutral-600 transition-transform duration-200'}
                          direction={isOpen ? 'up' : 'down'}
                        />
                      </button>
                      {isOpen ? <div>{section.content}</div> : null}
                    </div>
                  )
                }

                return (
                  <div key={section.key} className={'border border-neutral-300 rounded-lg bg-surface'}>
                    {section.content}
                  </div>
                )
              })}
          </div>
          <div className={'md:col-span-7 md:col-start-14 md:sticky md:h-fit'} style={{ top: '193.5px' }}>
            <div>
              <Widget
                vaultType={isV3 ? 'v3' : 'v2'}
                vaultAddress={currentVault.address}
                currentVault={currentVault}
                gaugeAddress={currentVault.staking.address}
                actions={[WidgetActionType.DepositFinal, WidgetActionType.WithdrawFinal]}
                chainId={chainId}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Index
