import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react'
import { Renderable } from '@lib/components/Renderable'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconAddToMetamask } from '@lib/icons/IconAddToMetamask'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { assert, cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { getExplorerAddressUrl } from '@vaults-v3/utils/explorer'
import { VaultInfo } from '@vaults-v2/components/details/tabs/VaultDetailsTabsWrapper'
import { VaultDetailsAbout } from '@vaults-v3/components/details/tabs/VaultDetailsAbout'
import { VaultDetailsStrategies } from '@vaults-v3/components/details/tabs/VaultDetailsStrategies'
import type { ReactElement } from 'react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { watchAsset } from 'viem/actions'
import { getConnectorClient } from 'wagmi/actions'
import { VaultRiskInfo } from './tabs/VaultRiskInfo'

type TTabsOptions = {
  value: number
  label: string
  slug?: string
}
type TTabs = {
  hasStrategies: boolean
  hasRisk: boolean
  selectedAboutTabIndex: number
  setSelectedAboutTabIndex: (arg0: number) => void
}

// Explorer link inlined with getExplorerAddressUrl

const Tabs = React.memo(function Tabs({
  hasStrategies,
  hasRisk,
  selectedAboutTabIndex,
  setSelectedAboutTabIndex
}: TTabs): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const tabs: TTabsOptions[] = useMemo((): TTabsOptions[] => {
    const tabs = [{ value: 0, label: 'About', slug: 'about' }]
    if (hasStrategies) {
      tabs.push({ value: 1, label: 'Strategies', slug: 'strategies' })
    }
    tabs.push({ value: 2, label: 'Info', slug: 'info' })
    if (hasRisk) {
      tabs.push({ value: 3, label: 'Risk', slug: 'risk' })
    }

    return tabs
  }, [hasStrategies, hasRisk])

  useEffect((): void => {
    const tabParam = searchParams.get('tab')
    const tab = tabs.find((tab): boolean => tab.slug === tabParam)
    if (tab?.value) {
      setSelectedAboutTabIndex(tab?.value)
    }
  }, [searchParams, setSelectedAboutTabIndex, tabs])

  return (
    <>
      <nav className={'hidden flex-row items-center space-x-10 md:flex'}>
        {tabs.map(
          (tab): ReactElement => (
            <button
              key={`desktop-${tab.value}`}
              onClick={(): void => {
                const newSearchParams = new URLSearchParams(searchParams)
                newSearchParams.set('tab', tab.slug || '')
                navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true })
                setSelectedAboutTabIndex(tab.value)
              }}
            >
              <p
                title={tab.label}
                aria-selected={selectedAboutTabIndex === tab.value}
                className={cl(
                  'hover-fix tab',
                  selectedAboutTabIndex === tab.value
                    ? 'text-neutral-900!'
                    : 'text-neutral-900/50! hover:text-neutral-900!'
                )}
              >
                {tab.label}
              </p>
            </button>
          )
        )}
      </nav>
      <div className={'relative z-50'}>
        <Listbox value={selectedAboutTabIndex} onChange={(value): void => setSelectedAboutTabIndex(value)}>
          {({ open }): ReactElement => (
            <>
              <ListboxButton
                className={
                  'flex h-10 w-40 flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 pl-4 font-bold focus:border-neutral-900 md:hidden'
                }
              >
                <div className={'relative flex flex-row items-center'}>
                  {tabs[selectedAboutTabIndex]?.label || 'Menu'}
                </div>
                <div className={'absolute right-2'}>
                  <IconChevron className={`size-4 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
                </div>
              </ListboxButton>
              <Transition
                show={open}
                enter={'transition duration-100 ease-out'}
                enterFrom={'transform scale-95 opacity-0'}
                enterTo={'transform scale-100 opacity-100'}
                leave={'transition duration-75 ease-out'}
                leaveFrom={'transform scale-100 opacity-100'}
                leaveTo={'transform scale-95 opacity-0'}
              >
                <ListboxOptions className={'yearn--listbox-menu scrollbar-none'}>
                  {tabs.map(
                    (tab): ReactElement => (
                      <ListboxOption className={'yearn--listbox-menu-item'} key={tab.value} value={tab.value}>
                        {tab.label}
                      </ListboxOption>
                    )
                  )}
                </ListboxOptions>
              </Transition>
            </>
          )}
        </Listbox>
      </div>
    </>
  )
})

const AddToWalletLink = React.memo(function AddToWalletLink({
  currentVault
}: {
  currentVault: TYDaemonVault
}): ReactElement {
  const { provider } = useWeb3()

  const onAddTokenToMetamask = useCallback(
    async (address: string, symbol: string, decimals: number, image: string): Promise<void> => {
      try {
        assert(provider, 'Provider is not set')
        const walletClient = await getConnectorClient(retrieveConfig())
        watchAsset(walletClient, {
          type: 'ERC20',
          options: {
            address: toAddress(address),
            decimals: decimals,
            symbol: symbol,
            image: image
          }
        })
      } catch (error) {
        console.error(error)
        // Token has not been added to MetaMask.
      }
    },
    [provider]
  )

  const handleClick = useCallback(() => {
    onAddTokenToMetamask(
      currentVault.address,
      currentVault.symbol,
      currentVault.decimals,
      `https://token-assets-one.vercel.app/api/token/${currentVault.chainID}/${currentVault.address}/logo-128.png`
    )
  }, [currentVault.address, currentVault.symbol, currentVault.decimals, currentVault.chainID, onAddTokenToMetamask])

  return (
    <button onClick={handleClick}>
      <span className={'sr-only'}>{'Add to wallet'}</span>
      <IconAddToMetamask className={'size-5 text-neutral-900/50 transition-colors hover:text-neutral-900 md:size-6'} />
    </button>
  )
})

// (Removed ExplorerLink component)

function VaultDetailsTabsWrapperComponent({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const [selectedAboutTabIndex, setSelectedAboutTabIndex] = useState(0)
  const hasStrategies = Number(currentVault.strategies?.length || 0) > 0

  return (
    <div className={'col-span-12 mt-6 flex flex-col rounded-3xl bg-neutral-100'}>
      <div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
        <Tabs
          hasStrategies={hasStrategies}
          hasRisk={true}
          selectedAboutTabIndex={selectedAboutTabIndex}
          setSelectedAboutTabIndex={setSelectedAboutTabIndex}
        />

        <div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
          <AddToWalletLink currentVault={currentVault} />
          <a href={getExplorerAddressUrl(currentVault.chainID, currentVault.address)} target={'_blank'} rel={'noopener noreferrer'}>
            <span className={'sr-only'}>{'Open in explorer'}</span>
            <IconLinkOut className={'size-5 cursor-alias text-neutral-900/50 transition-colors hover:text-neutral-900 md:size-6'} />
          </a>
        </div>
      </div>

      <div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 0}>
        <VaultDetailsAbout currentVault={currentVault} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 1}>
        <VaultDetailsStrategies currentVault={currentVault} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 2}>
        <VaultInfo currentVault={currentVault} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 3}>
        <VaultRiskInfo currentVault={currentVault} />
      </Renderable>
    </div>
  )
}

export const VaultDetailsTabsWrapper = React.memo(VaultDetailsTabsWrapperComponent)
