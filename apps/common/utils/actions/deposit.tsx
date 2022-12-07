import {ethers} from 'ethers';

import type {BigNumber} from 'ethers';

export async function	deposit(
	provider: ethers.providers.Web3Provider,
	vaultAddress: string,
	amount: BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			vaultAddress,
			['function deposit(uint256) external returns (uint256)'],
			signer
		);
		const	transaction = await contract.deposit(amount);
		const	transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}
