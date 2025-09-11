import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { ActionFlowContextApp } from '@vaults-v2/contexts/useActionFlow'
import { WithSolverContextApp } from '@vaults-v2/contexts/useSolver'
import { VaultActionsTabsWrapper } from '@vaults-v3/components/details/VaultActionsTabsWrapper'
import { VaultDetailsHeader } from '@vaults-v3/components/details/VaultDetailsHeader'
import { VaultDetailsTabsWrapper } from '@vaults-v3/components/details/VaultDetailsTabsWrapper'
import { fetchYBoldVault } from '@vaults-v3/utils/handleYBold'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '/src/components/Link'

function Index(): ReactElement | null {
  const { address, isActive } = useWeb3()
  const params = useParams()
  const { onRefresh } = useWallet()
  const { yDaemonBaseUri } = useYDaemonBaseURI({ chainID: Number(params.chainID) })

  // Use vault address as key to reset state
  const vaultKey = `${params.chainID}-${params.address}`
  const [_currentVault, setCurrentVault] = useState<TYDaemonVault | undefined>(undefined)
  const [isInit, setIsInit] = useState(false)
  const [overrideVault, setOverrideVault] = useState<TYDaemonVault | undefined>(undefined)
  const [hasFetchedOverride, setHasFetchedOverride] = useState(false)
  const [lastVaultKey, setLastVaultKey] = useState(vaultKey)

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
        tokensToRefresh.push({ address: currentVault.address, chainID: currentVault.chainID })
      }
      if (currentVault?.token?.address) {
        tokensToRefresh.push({ address: currentVault.token.address, chainID: currentVault.chainID })
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
    <div className={'mx-auto w-full max-w-[1232px] pt-20 md:pt-32 px-4'}>
      {/* Mobile Back Button */}
      <nav className={'mb-4 self-start md:mb-2 md:hidden'}>
        <Link href={'/v3'} className={'z-50 w-fit block'}>
          <p className={'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'}>
            <span className={'pr-2 leading-[normal]'}>&#10229;</span>
            {'  Back'}
          </p>
        </Link>
      </nav>
      {/* Header with gradient background and vault logo */}
      <header
        className={cl(
          'h-full rounded-3xl',
          'pt-6 pb-6 md:pb-10 px-4 md:px-8',
          'bg-[linear-gradient(73deg,#D21162_24.91%,#2C3DA6_99.66%)]',
          'relative flex flex-col items-center justify-center'
        )}
      >
        <nav className={'mb-4 hidden self-start md:mb-2 md:block'}>
          <Link href={'/v3'} className={'w-fit block'}>
            <p
              className={'flex w-fit text-xs text-neutral-900/70 transition-colors hover:text-neutral-900 md:text-base'}
            >
              <span className={'pr-2 leading-[normal]'}>&#10229;</span>
              {'  Back'}
            </p>
          </Link>
        </nav>
        <div className={'absolute -top-10 md:-top-6'}>
          <div
            className={cl(
              'h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-[#FAD1ED7A] backdrop-blur-sm',
              'flex justify-center items-center'
            )}
          >
            <ImageWithFallback
              className={'size-10 md:size-12'}
              src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-128.png`}
              alt={''}
              width={48}
              height={48}
            />
          </div>
        </div>
        <VaultDetailsHeader currentVault={currentVault} />
      </header>

      <section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
        {currentVault && (
          <ActionFlowContextApp currentVault={currentVault}>
            <WithSolverContextApp>
              <VaultActionsTabsWrapper currentVault={currentVault} />
            </WithSolverContextApp>
          </ActionFlowContextApp>
        )}
        {currentVault && <VaultDetailsTabsWrapper currentVault={currentVault} />}
      </section>
    </div>
  )
}

export default Index
