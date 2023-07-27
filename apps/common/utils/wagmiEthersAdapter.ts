import {providers} from 'ethers';
import {type HttpTransport} from 'viem';
import {getPublicClient, getWalletClient, type PublicClient, type WalletClient} from '@wagmi/core';

export function publicClientToProvider(publicClient: PublicClient): providers.JsonRpcProvider | providers.FallbackProvider {
	const {chain, transport} = publicClient;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address
	};
	if (transport.type === 'fallback') {
		return new providers.FallbackProvider(
			(transport.transports as ReturnType<HttpTransport>[]).map(
				({value}): providers.JsonRpcProvider => new providers.JsonRpcProvider(value?.url, network)
			)
		);
	}
	return new providers.JsonRpcProvider(transport.url, network);
}

/** Action to convert a viem Public Client to an ethers.js Provider. */
export function getEthersProvider({chainId}: { chainId?: number } = {}): providers.JsonRpcProvider | providers.FallbackProvider {
	const publicClient = getPublicClient({chainId});
	return publicClientToProvider(publicClient);
}

export function walletClientToSigner(walletClient: WalletClient): providers.JsonRpcSigner {
	const {account, chain, transport} = walletClient;
	const network = {
		chainId: chain.id,
		name: chain.name,
		ensAddress: chain.contracts?.ensRegistry?.address
	};
	const provider = new providers.Web3Provider(transport, network);
	const signer = provider.getSigner(account.address);
	return signer;
}

/** Action to convert a viem Wallet Client to an ethers.js Signer. */
export async function getEthersSigner({chainId}: { chainId?: number } = {}): Promise<providers.JsonRpcSigner | undefined> {
	const walletClient = await getWalletClient({chainId});
	if (!walletClient) {
		return undefined;
	}
	return walletClientToSigner(walletClient);
}
