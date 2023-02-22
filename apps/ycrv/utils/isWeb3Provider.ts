import type {ethers} from 'ethers';

export function isWeb3Provider(provider: ethers.providers.Provider | ethers.providers.Web3Provider): provider is ethers.providers.Web3Provider {
	return (provider as ethers.providers.Web3Provider).getSigner !== undefined;
}
