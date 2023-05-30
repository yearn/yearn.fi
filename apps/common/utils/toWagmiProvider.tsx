import {toAddress, toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import {assert} from '@common/utils/assert';

import type {Connector} from 'wagmi';
import type {TAddress, TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {GetWalletClientResult} from '@wagmi/core';

export type TWagmiProviderContract = {
	walletClient: GetWalletClientResult,
	chainId: number,
	address: string,
}
export async function toWagmiProvider(connector: Connector | undefined): Promise<TWagmiProviderContract> {
	assert(connector, 'Connector is not set');

	const signer = await connector.getWalletClient();
	const chainId = await connector.getChainId();
	const address = toWagmiAddress(signer.account.address);
	return ({
		walletClient: signer,
		chainId,
		address
	});
}

export type TWriteTransaction = {
	connector: Connector | undefined;
	contractAddress: TAddressWagmi;
	statusHandler?: (status: typeof defaultTxStatus) => void;
}

export function assertAddress(addr: string): asserts addr is TAddress {
	assert(isTAddress(addr), 'Address provided is invalid');
	assert(toAddress(addr) !== ZERO_ADDRESS, 'Address is 0x0');
	assert(toAddress(addr) !== ETH_TOKEN_ADDRESS, 'Address is 0xE');
}
