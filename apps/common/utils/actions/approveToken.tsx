import {ethers} from 'ethers';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	isApprovedERC20(
	provider: ethers.providers.JsonRpcProvider,
	tokenAddress: string,
	spender: string,
	amount = ethers.constants.MaxUint256
): Promise<boolean> {
	const	signer = provider.getSigner();
	const	address = await signer.getAddress();

	try {
		const	contract = new ethers.Contract(
			tokenAddress,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			provider
		);
		const value = await contract.allowance(address, spender);
		return value.gte(amount);
	} catch (error) {
		return false;
	}
}

export async function	approvedERC20Amount(
	provider: ethers.providers.JsonRpcProvider,
	tokenAddress: string,
	spender: string
): Promise<ethers.BigNumber> {
	const	signer = provider.getSigner();
	const	address = await signer.getAddress();

	try {
		const	contract = new ethers.Contract(
			tokenAddress,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			provider
		);
		return await contract.allowance(address, spender);
	} catch (error) {
		return Zero;
	}
}

export async function	approveERC20(
	provider: ethers.providers.JsonRpcProvider | ethers.providers.JsonRpcProvider,
	tokenAddress: string,
	spender: string,
	amount = ethers.constants.MaxUint256
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(tokenAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(spender, amount));
}
