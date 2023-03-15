import {ethers} from 'ethers';
import {MaxUint256, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	isApprovedERC20(
	provider: TWeb3Provider,
	tokenAddress: string,
	spender: string,
	amount = MaxUint256
): Promise<boolean> {
	try {
		const signer = await provider.getSigner();
		const address = await signer.getAddress();
		const contract = new ethers.Contract(
			tokenAddress,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			signer
		);
		const value = await contract.allowance(address, spender);
		return value.gte(amount);
	} catch (error) {
		return false;
	}
}

export async function	approvedERC20Amount(
	provider: TWeb3Provider,
	tokenAddress: string,
	spender: string
): Promise<bigint> {
	try {
		const signer = await provider.getSigner();
		const address = await signer.getAddress();
		const contract = new ethers.Contract(
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
	provider: TWeb3Provider,
	tokenAddress: string,
	spender: string,
	amount = MaxUint256
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(tokenAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(spender, amount));
}
