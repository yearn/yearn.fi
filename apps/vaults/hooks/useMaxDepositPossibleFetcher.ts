import {useCallback} from 'react';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export type TMaxDepositPossibleFetcher = {
	vault: TYDaemonVault;
}

export function useMaxDepositPossibleFetcher(): ({vault}: TMaxDepositPossibleFetcher) => Promise<BigNumber> {
	const {provider, chainID} = useWeb3();

	return useCallback(async ({vault}: TMaxDepositPossibleFetcher): Promise<BigNumber> => {
		const currentProvider = provider || getProvider(chainID);
		const contract = new ethers.Contract(
			toAddress(vault.address),
			['function depositLimit() public view returns (uint256)'],
			currentProvider
		);
		try {
			return contract.depositLimit();
		} catch (error) {
			console.error(error);
			return Zero;
		}
	}, [chainID, provider]);
}
