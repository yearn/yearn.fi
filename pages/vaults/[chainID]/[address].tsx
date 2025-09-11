import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
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
import { useParams } from 'react-router-dom'

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

  return (
    <div className={'mx-auto my-0 mt-24 max-w-[1232px] md:mb-0 px-4'}>
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
            src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-128.png`}
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

export default Index
