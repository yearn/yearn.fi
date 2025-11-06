import { Renderable } from '@lib/components/Renderable'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { IconAddToMetamask } from '@lib/icons/IconAddToMetamask'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { assert, cl, isZero, toAddress, toBigInt, toNormalizedValue } from '@lib/utils'
import { formatDate } from '@lib/utils/format.time'
import type { TYDaemonVault, TYDaemonVaultHarvests } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultHarvestsSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { VaultDetailsAbout } from '@vaults-v2/components/details/tabs/VaultDetailsAbout'
import { VaultDetailsHistorical } from '@vaults-v2/components/details/tabs/VaultDetailsHistorical'
import { VaultDetailsStrategies } from '@vaults-v2/components/details/tabs/VaultDetailsStrategies'
import type { ReactElement } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { watchAsset } from 'viem/actions'
import { getConnectorClient } from 'wagmi/actions'

type TTabsOptions = {
  value: number
  label: string
  slug?: string
  mobileLabel?: string
}
type TTabs = {
  selectedAboutTabIndex: number
  setSelectedAboutTabIndex: (arg0: number) => void
}

type TExplorerLinkProps = {
  explorerBaseURI?: string
  currentVaultAddress: string
}

/**************************************************************************************************
 ** The MobileTabButtons component will be used to display the tab buttons to navigate between the
 ** different tabs on mobile devices.
 *************************************************************************************************/
function MobileTabButton(props: {
  selected: boolean
  selectedIndex: number
  currentTab: TTabsOptions
  setCurrentTab: (index: number) => void
}): ReactElement {
  return (
    <button
      onClick={() => {
        props.setCurrentTab(props.selectedIndex)
      }}
      className={cl(
        'flex h-10 overflow-hidden pr-4 transition-all duration-300 flex-row items-center border-0 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden',
        props.selected ? 'border-b-2 border-neutral-900' : 'border-b-2 border-neutral-300'
      )}
    >
      <span>{props.currentTab.mobileLabel || props.currentTab.label}</span>
    </button>
  )
}

function Tabs({ selectedAboutTabIndex, setSelectedAboutTabIndex }: TTabs): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const tabs: TTabsOptions[] = useMemo(
    (): TTabsOptions[] => [
      { value: 0, label: 'About', slug: 'about' },
      { value: 1, label: 'Strategies', slug: 'strategies', mobileLabel: 'Strats' },
      { value: 2, label: 'Harvests', slug: 'harvests' },
      { value: 3, label: 'Info', slug: 'info' }
    ],
    []
  )

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
              <p title={tab.label} aria-selected={selectedAboutTabIndex === tab.value} className={'hover-fix tab'}>
                {tab.label}
              </p>
            </button>
          )
        )}
      </nav>
      <div className={'relative z-50'}>
        <div className={'flex items-center space-x-2'}>
          {tabs.map(
            (tab): ReactElement => (
              <Fragment key={`mobile-${tab.value}`}>
                <MobileTabButton
                  selected={selectedAboutTabIndex === tab.value}
                  currentTab={tab}
                  selectedIndex={tab.value}
                  setCurrentTab={(): void => {
                    const newSearchParams = new URLSearchParams(searchParams)
                    newSearchParams.set('tab', tab.slug || '')
                    navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true })
                    setSelectedAboutTabIndex(tab.value)
                  }}
                />
              </Fragment>
            )
          )}
        </div>
      </div>
    </>
  )
}

function ExplorerLink({ explorerBaseURI, currentVaultAddress }: TExplorerLinkProps): ReactElement | null {
  return (
    <a href={`${explorerBaseURI}/address/${currentVaultAddress}`} target={'_blank'} rel={'noopener noreferrer'}>
      <span className={'sr-only'}>{'Open in explorer'}</span>
      <IconLinkOut
        className={'size-5 cursor-alias text-neutral-600 transition-colors hover:text-neutral-900 md:size-6'}
      />
    </a>
  )
}

export function VaultInfo({
  currentVault,
  yDaemonBaseUri
}: {
  currentVault: TYDaemonVault
  yDaemonBaseUri: string
}): ReactElement {
  const blockExplorer =
    getNetwork(currentVault.chainID).blockExplorers?.etherscan?.url ||
    getNetwork(currentVault.chainID).blockExplorers?.default.url

  return (
    <div className={'grid w-full grid-cols-1 gap-10 p-4 md:p-8'}>
      <div className={'col-span-1 grid w-full gap-1'}>
        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Vault Contract Address'}</p>
          <a
            className={'font-number text-sm text-neutral-900 hover:underline'}
            href={`${blockExplorer}/address/${currentVault.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            suppressHydrationWarning
          >
            {currentVault.address}
          </a>
        </div>

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Token Contract Address'}</p>
          <a
            href={`${blockExplorer}/address/${currentVault.token.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className={'font-number text-sm text-neutral-900 hover:underline'}
            suppressHydrationWarning
          >
            {currentVault.token.address}
          </a>
        </div>

        {currentVault.staking.available ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Staking Contract Address'}</p>
            <a
              href={`${blockExplorer}/address/${currentVault.staking.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.staking.address}
            </a>
          </div>
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('curve.finance') ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Curve deposit URI'}</p>
            <a
              href={currentVault.info.sourceURL}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.info.sourceURL}
            </a>
          </div>
        ) : null}

        {(currentVault.info?.sourceURL || '')?.includes('gamma') ? (
          <div className={'flex flex-col items-center md:flex-row'}>
            <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Gamma Pair'}</p>
            <a
              href={currentVault.info.sourceURL}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'font-number whitespace-nowrap text-sm text-neutral-900 hover:underline'}
              suppressHydrationWarning
            >
              {currentVault.info.sourceURL}
            </a>
          </div>
        ) : null}

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Price Per Share'}</p>
          <p className={'font-number text-sm text-neutral-900'} suppressHydrationWarning>
            {currentVault.apr.pricePerShare.today}
          </p>
        </div>

        <div className={'flex flex-col items-center md:flex-row'}>
          <p className={'w-full text-sm text-neutral-500 md:w-44'}>{'yDaemon Vault Data'}</p>
          <a
            href={`${yDaemonBaseUri}/vaults/${currentVault.address}`}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className={'font-number text-sm text-neutral-900 hover:underline'}
            suppressHydrationWarning
          >
            {`${yDaemonBaseUri}/vaults/${currentVault.address}`}
          </a>
        </div>
      </div>
    </div>
  )
}

export function VaultDetailsTabsWrapper({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { provider } = useWeb3()
  const { yDaemonBaseUri } = useYDaemonBaseURI({ chainID: currentVault.chainID })
  const [selectedAboutTabIndex, setSelectedAboutTabIndex] = useState(0)

  async function onAddTokenToMetamask(address: string, symbol: string, decimals: number, image: string): Promise<void> {
    try {
      assert(provider, 'Provider is not set')
      const walletClient = await getConnectorClient(retrieveConfig())
      await watchAsset(walletClient, {
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
  }

  const { data: yDaemonHarvestsData, isLoading } = useFetch<TYDaemonVaultHarvests>({
    endpoint: `${yDaemonBaseUri}/vaults/harvests/${currentVault.address}`,
    schema: yDaemonVaultHarvestsSchema
  })

  const harvestData = useMemo((): { name: string; value: number }[] => {
    const _yDaemonHarvestsData = [...(yDaemonHarvestsData || [])].reverse()
    return _yDaemonHarvestsData.map((harvest): { name: string; value: number } => ({
      name: formatDate(Number(harvest.timestamp) * 1000),
      value: toNormalizedValue(toBigInt(harvest.profit) - toBigInt(harvest.loss), currentVault.decimals)
    }))
  }, [currentVault.decimals, yDaemonHarvestsData])

  return (
    <div className={'col-span-12 mb-4 flex flex-col rounded-3xl bg-neutral-100 py-2'}>
      <div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
        <Tabs selectedAboutTabIndex={selectedAboutTabIndex} setSelectedAboutTabIndex={setSelectedAboutTabIndex} />

        <div className={'flex items-center justify-end space-x-2 pb-0 md:flex-row md:pb-4 md:last:space-x-4'}>
          <button
            onClick={(): void => {
              onAddTokenToMetamask(
                currentVault.address,
                currentVault.symbol,
                currentVault.decimals,
                `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${currentVault.chainID}/${currentVault.address}/logo-32.png`
              )
            }}
          >
            <span className={'sr-only'}>{'Add to wallet'}</span>
            <IconAddToMetamask
              className={'size-5 text-neutral-600 transition-colors hover:text-neutral-900 md:size-6'}
            />
          </button>
          <ExplorerLink
            explorerBaseURI={getNetwork(currentVault.chainID)?.defaultBlockExplorer}
            currentVaultAddress={currentVault.address}
          />
        </div>
      </div>

      <div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

      <Renderable shouldRender={currentVault && isZero(selectedAboutTabIndex)}>
        <VaultDetailsAbout currentVault={currentVault} harvestData={harvestData} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 1}>
        <VaultDetailsStrategies currentVault={currentVault} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 2}>
        <VaultDetailsHistorical currentVault={currentVault} isLoading={isLoading} harvests={yDaemonHarvestsData} />
      </Renderable>

      <Renderable shouldRender={currentVault && selectedAboutTabIndex === 3}>
        <VaultInfo currentVault={currentVault} yDaemonBaseUri={yDaemonBaseUri} />
      </Renderable>
    </div>
  )
}
