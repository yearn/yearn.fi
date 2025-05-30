import {useMemo} from 'react';
import {providers} from 'ethers';
import {useConnectorClient} from 'wagmi';
import {getClient, getConnectorClient} from 'wagmi/actions';
import {type Config} from 'wagmi';

import type {Account, Chain, Client, Transport} from 'viem';

export function clientToProvider(
	client: Client<Transport, Chain>
): providers.JsonRpcProvider | providers.FallbackProvider {
	const {chain, transport} = client;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address
	};
	if (transport.type === 'fallback') {
		return new providers.FallbackProvider(
			(transport.transports as ReturnType<Transport>[]).map(
				({value}) => new providers.JsonRpcProvider(value?.url, network)
			)
		);
	}
	return new providers.JsonRpcProvider(transport.url, network);
}

/** Action to convert a viem Public Client to an ethers.js Provider. */
export function getEthersProvider(
	config: Config,
	{chainId}: {chainId?: number} = {}
): providers.JsonRpcProvider | providers.FallbackProvider {
	const client = getClient(config, {chainId});
	return clientToProvider(client as Client<Transport, Chain>);
}

export function clientToSigner(client: Client<Transport, Chain, Account>): providers.JsonRpcSigner {
	const {account, chain, transport} = client;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address
	};
	const provider = new providers.Web3Provider(transport, network);
	const signer = provider.getSigner(account.address);
	return signer;
}

export async function getEthersSigner(
	config: Config,
	{chainId}: {chainId?: number} = {}
): Promise<providers.JsonRpcSigner> {
	const client = await getConnectorClient(config, {chainId});
	return clientToSigner(client);
}

/** Hook to convert a Viem Client to an ethers.js Signer. */
export async function useEthersSigner({chainId}: {chainId?: number} = {}): Promise<
	providers.JsonRpcSigner | undefined
> {
	const {data: client} = useConnectorClient({chainId});
	return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
