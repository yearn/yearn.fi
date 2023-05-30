import {ethers} from 'ethers';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export type TMaxDepositPossibleFetcher = {
	provider?: ethers.providers.Provider;
	vault: TYDaemonVault;
}

export async function fetchMaxPossibleDeposit({provider, vault}: TMaxDepositPossibleFetcher): Promise<BigNumber> {
	const currentProvider = provider || getProvider(vault.chainID);
	const contract = new ethers.Contract(
		toAddress(vault.address),
		['function depositLimit() public view returns (uint256)'],
		currentProvider
	);
	try {
		return await contract.depositLimit();
	} catch (error) {
		console.error(error);
		return Zero;
	}
}
