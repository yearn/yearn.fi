import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { IconAlertError } from '@lib/icons/IconAlertError'
import { IconClose } from '@lib/icons/IconClose'
import { toAddress } from '@lib/utils'
import { variants } from '@lib/utils/animations'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultDetailsTabsWrapper } from '@vaults-v2/components/details/tabs/VaultDetailsTabsWrapper'
import { VaultActionsTabsWrapper } from '@vaults-v2/components/details/VaultActionsTabsWrapper'
import { ActionFlowContextApp } from '@vaults-v2/contexts/useActionFlow'
import { WithSolverContextApp } from '@vaults-v2/contexts/useSolver'
import { VaultDetailsHeader } from '@vaults-v3/components/details/VaultDetailsHeader'
import { motion } from 'framer-motion'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

const INCIDENT_VAULT_ADDRESS = '0x58900d761ae3765b75ddfc235c1536b527f25d8f'

function Index(): ReactElement | null {
  const { address, isActive } = useWeb3()
  const params = useParams()

  const { onRefresh } = useWallet()
  const { yDaemonBaseUri } = useYDaemonBaseURI({ chainID: Number(params.chainID) })

  // Use vault address as key to properly handle navigation
  const vaultKey = `${params.chainID}-${params.address}`
  const [currentVault, setCurrentVault] = useState<TYDaemonVault | undefined>(undefined)
  const [isInit, setIsInit] = useState(false)
  const [lastVaultKey, setLastVaultKey] = useState(vaultKey)

  // Reset state when vault changes
  useEffect(() => {
    if (vaultKey !== lastVaultKey) {
      setCurrentVault(undefined)
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

  useEffect((): void => {
    if (vault && (!currentVault || vault.address !== currentVault.address)) {
      setCurrentVault(vault)
      setIsInit(true)
    }
  }, [vault, currentVault])

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
          <p className={'text-sm text-neutral-900'}>{"We couln't find this vault on the connected network."}</p>
        </div>
      </div>
    )
  }

  const isIncidentVault =
    currentVault.chainID === 1 && toAddress(currentVault.address) === toAddress(INCIDENT_VAULT_ADDRESS)

  return (
    <div className={'mx-auto my-0 mt-24 max-w-[1232px] md:mb-0 px-4'}>
      {isIncidentVault ? (
        <div className={'mb-6'}>
          <IncidentBanner />
        </div>
      ) : null}
      <header className={'pointer-events-none flex w-full items-center justify-center'}>
        <motion.div
          key={'Vaults'}
          initial={'initial'}
          animate={'enter'}
          variants={variants}
          className={'pointer-events-none cursor-pointer md:-mt-0 '}
        >
          <ImageWithFallback
            className={'size-12 md:size-[72px]'}
            src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-128.png`}
            alt={''}
            width={72}
            height={72}
          />
        </motion.div>
      </header>

      <section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-10'}>
        <VaultDetailsHeader currentVault={currentVault} />
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

function IncidentBanner(): ReactElement | null {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={
        'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-black md:px-6 md:py-4 md:text-base'
      }
    >
      <div className={'flex items-start gap-3'}>
        <IconAlertError className={'mt-0.5 size-5 text-amber-700'} />
        <p className={'flex-1 leading-relaxed'}>
          {
            "The yETH pool has been paused following a security incident. Yearn's v2 and v3 vault code is not impacted. More updates will be provided as we have them. Please check X/twitter for the most up to date information: "
          }
          <a
            href={'https://x.com/yearnfi'}
            target={'_blank'}
            rel={'noreferrer'}
            className={'underline underline-offset-2 transition-colors hover:text-amber-800'}
          >
            {'https://x.com/yearnfi'}
          </a>
        </p>
        <button
          type={'button'}
          aria-label={'Dismiss announcement'}
          onClick={(): void => setIsVisible(false)}
          className={'mt-0.5 text-neutral-500 transition hover:text-neutral-700'}
        >
          <IconClose className={'size-4'} />
        </button>
      </div>
    </div>
  )
}

export default Index
