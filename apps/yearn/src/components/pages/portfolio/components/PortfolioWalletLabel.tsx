import { truncateHex } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { resolveEnsName } from '@yearn/wallet-ui/ens'
import type { Address } from 'viem'
import { mainnet } from 'viem/chains'
import { usePublicClient } from 'wagmi'

export function usePortfolioWalletName(wallet?: Address) {
  const client = usePublicClient({ chainId: mainnet.id })
  const { data } = useQuery({
    queryKey: ['portfolio-wallet-ens', wallet?.toLowerCase()],
    enabled: Boolean(wallet && client),
    queryFn: () => (wallet && client ? resolveEnsName(client, wallet) : null),
    staleTime: 10 * 60 * 1000,
    retry: false
  })
  return data
}

export function PortfolioWalletLabel({ wallet, className }: { wallet: Address; className?: string }) {
  const name = usePortfolioWalletName(wallet)
  return (
    <span className={className} title={name ? `${name} (${wallet})` : wallet}>
      {name ?? truncateHex(wallet, 6)}
    </span>
  )
}
