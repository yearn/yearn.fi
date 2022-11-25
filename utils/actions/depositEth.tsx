import	{ContractInterface, ethers} from	'ethers';
import ZAP_ETH_TO_YVETH_ABI from 'utils/abi/zapEthToYvEth.abi';

export async function	depositETH(
	provider: ethers.providers.Web3Provider,
	amount: ethers.BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			process.env.ZAP_ETH_WETH_CONTRACT as string,
			ZAP_ETH_TO_YVETH_ABI as ContractInterface,
			signer
		);
		const	transaction = await contract.deposit({value: amount});
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