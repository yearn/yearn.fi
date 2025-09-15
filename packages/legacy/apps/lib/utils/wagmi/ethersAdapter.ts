import type { JsonRpcSigner } from 'ethers'
import { BrowserProvider, FallbackProvider, JsonRpcProvider } from 'ethers'
import { useMemo } from 'react'
import type { Account, Chain, Client, Transport } from 'viem'
import { type Config, useConnectorClient } from 'wagmi'
import { getClient, getConnectorClient } from 'wagmi/actions'

export function clientToProvider(client: Client<Transport, Chain>): JsonRpcProvider | FallbackProvider {
  const { chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  }
  if (transport.type === 'fallback') {
    return new FallbackProvider(
      (transport.transports as ReturnType<Transport>[]).map(({ value }) => new JsonRpcProvider(value?.url, network))
    )
  }
  // @ts-ignore viem transport typing
  return new JsonRpcProvider((transport as any).url, network)
}

/** Action to convert a viem Public Client to an ethers.js Provider. */
export function getEthersProvider(
  config: Config,
  { chainId }: { chainId?: number } = {}
): JsonRpcProvider | FallbackProvider {
  const client = getClient(config, { chainId })
  return clientToProvider(client as Client<Transport, Chain>)
}

export function clientToSigner(client: Client<Transport, Chain, Account>): JsonRpcSigner {
  const { account, chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  }
  // BrowserProvider in ethers v6 accepts EIP-1193 providers
  // Note: getSigner is async in v6, but we keep the signature by casting.
  // @ts-ignore transport is EIP-1193 provider
  const provider = new BrowserProvider(transport as any, network)
  // @ts-ignore compat: treat as sync for existing usage (callers await upstream wrapper)
  const signer = (provider as any).getSigner(account.address)
  return signer as unknown as JsonRpcSigner
}

export async function getEthersSigner(config: Config, { chainId }: { chainId?: number } = {}): Promise<JsonRpcSigner> {
  const client = await getConnectorClient(config, { chainId })
  return clientToSigner(client)
}

/** Hook to convert a Viem Client to an ethers.js Signer. */
export async function useEthersSigner({ chainId }: { chainId?: number } = {}): Promise<JsonRpcSigner | undefined> {
  const { data: client } = useConnectorClient({ chainId })
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client])
}
