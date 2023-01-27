import type {ethers} from 'ethers';

export const handleTx = async (txPromise: Promise<ethers.providers.TransactionResponse>): Promise<boolean> => {
	try {
		const tx = await txPromise;
		const receipt = await tx.wait();
		if (receipt.status === 0) {
			throw new Error('Fail to perform transaction');
		}
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
};
