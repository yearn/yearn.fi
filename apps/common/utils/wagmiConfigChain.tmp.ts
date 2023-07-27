/* eslint-disable @typescript-eslint/prefer-optional-chain */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */

//SEE https://github.com/wagmi-dev/wagmi/issues/2815

import {createPublicClient, fallback, http, webSocket} from 'viem';

import type {FallbackTransport,
	FallbackTransportConfig,
	PublicClientConfig} from 'viem';
import type {Chain, ChainProviderFn, PublicClient, WebSocketPublicClient} from 'wagmi';

type RpcUrls = {
	http: readonly string[]
	webSocket?: readonly string[]
}

export type ConfigureChainsConfig = Pick<
FallbackTransportConfig,
'rank' | 'retryCount' | 'retryDelay'
> &
Pick<PublicClientConfig, 'batch' | 'pollingInterval'> & {
	stallTimeout?: number
}

export function configureChains<TChain extends Chain = Chain>(
	defaultChains: TChain[],
	providers: ChainProviderFn<TChain>[],
	{
		batch = {multicall: {wait: 32}},
		pollingInterval = 4_000,
		rank,
		retryCount,
		retryDelay,
		stallTimeout
	}: ConfigureChainsConfig = {}
) {
	if (!defaultChains.length) {
		throw new Error('must have at least one chain');
	}

	let chains: TChain[] = [];
	const httpUrls: {
		[chainId: number]: RpcUrls['http']
	} = {};
	const wsUrls: {
		[chainId: number]: RpcUrls['webSocket']
	} = {};

	for (const chain of defaultChains) {
		let configExists = false;
		for (const provider of providers) {
			const apiConfig = provider(chain);

			// If no API configuration was found (ie. no RPC URL) for
			// this provider, then we skip and check the next one.
			if (!apiConfig) {
				continue;
			}

			configExists = true;

			if (!chains.some(({id}) => id === chain.id)) {
				chains = [...chains, apiConfig.chain];
			}
			httpUrls[chain.id] = [
				...(httpUrls[chain.id] || []),
				...apiConfig.rpcUrls.http
			];
			if (apiConfig.rpcUrls.webSocket) {
				wsUrls[chain.id] = [
					...(wsUrls[chain.id] || []),
					...apiConfig.rpcUrls.webSocket
				];
			}
		}

		// If no API configuration was found across the providers
		// then we throw an error to the consumer.
		if (!configExists) {
			throw new Error(
				[
					`Could not find valid provider configuration for chain "${chain.name}".\n`,
					"You may need to add `jsonRpcProvider` to `configureChains` with the chain's RPC URLs.",
					'Read more: https://wagmi.sh/core/providers/jsonRpc'
				].join('\n')
			);
		}
	}

	return {
		chains,
		publicClient: ({chainId}: { chainId?: number }) => {
			const activeChain = (chains.find((x) => x.id === chainId) ??
			defaultChains[0]) as TChain;
			const chainHttpUrls = httpUrls[activeChain.id];

			if (!chainHttpUrls || !chainHttpUrls[0]) {
				throw new Error(`No providers configured for chain "${activeChain.id}"`);
			}

			const publicClient = createPublicClient({
				batch,
				chain: activeChain,
				transport: fallback(
					chainHttpUrls.map((url: string) => {
						const urlAsNodeURL = new URL(url);
						let headers = {};
						if (urlAsNodeURL.username && urlAsNodeURL.password) {
							headers = {
								'Authorization': `Basic ${btoa(urlAsNodeURL.username + ':' + urlAsNodeURL.password)}`
							};
							url = urlAsNodeURL.href.replace(`${urlAsNodeURL.username}:${urlAsNodeURL.password}@`, '');
						}
						return http(url, {timeout: stallTimeout, fetchOptions: {headers}});
					}),
					{rank, retryCount, retryDelay}
				),
				pollingInterval
			});

			return Object.assign(publicClient, {
				chains
			}) as PublicClient<FallbackTransport>;
		},
		webSocketPublicClient: ({chainId}: { chainId?: number }) => {
			const activeChain = (chains.find((x) => x.id === chainId) ??
			defaultChains[0]) as TChain;
			const chainWsUrls = wsUrls[activeChain.id];

			if (!chainWsUrls || !chainWsUrls[0]) {
				return undefined;
			}

			const publicClient = createPublicClient({
				batch,
				chain: activeChain,
				transport: fallback(
					chainWsUrls.map((url: string) => webSocket(url, {timeout: stallTimeout})),
					{rank, retryCount, retryDelay}
				),
				pollingInterval
			});

			return Object.assign(publicClient, {
				chains
			}) as WebSocketPublicClient<FallbackTransport>;
		}
	} as const;
}
