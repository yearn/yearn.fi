import {ethers} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import VLYCRV_ABI from './abi/vlYCrv.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export type TVlyCRVDepositProps = {
	provider: ethers.providers.Web3Provider;
	amount: BigNumber;
}

export type TVlyCRVWithdrawProps = {
	provider: ethers.providers.Web3Provider;
	amount: BigNumber;
}

export type TVoteTxProps = {
	provider: ethers.providers.Web3Provider;
	votes?: BigNumber;
	gaugeAddress: TAddress;
}

const handleTx = async (txPromise: Promise<ethers.providers.TransactionResponse>): Promise<boolean> => {
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

export async function vLyCRVDeposit({provider, amount}: TVlyCRVDepositProps): Promise<boolean> {
	const signer = provider.getSigner();

	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);

	return handleTx(contract.deposit(amount));
}

export async function vLyCRVWithdraw({provider, amount}: TVlyCRVWithdrawProps): Promise<boolean> {
	const signer = provider.getSigner();

	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);

	return handleTx(contract.withdraw(amount));
}

export async function vLyCRVVote({provider, gaugeAddress, votes}: TVoteTxProps): Promise<boolean> {
	const signer = provider.getSigner();

	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	
	return handleTx(contract.vote(gaugeAddress, votes));
}

export async function	addLiquidity(
	provider: ethers.providers.Web3Provider,
	amount1: BigNumber,
	amount2: BigNumber,
	expectedAmount: BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			YVECRV_POOL_LP_ADDRESS,
			['function add_liquidity(uint256[2], uint256)'],
			signer
		);
		const	SLIPPAGE = 0.2;
		const	minAmountStr = Number(ethers.utils.formatUnits(expectedAmount, 18));
		const	minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - SLIPPAGE)).toFixed(18), 18);
		const	transaction = await contract.add_liquidity([amount1, amount2], minAmountWithSlippage);
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

export async function	zap(
	provider: ethers.providers.Web3Provider,
	inputToken: string,
	outputToken: string,
	amount: BigNumber,
	minAmount: BigNumber,
	slippage: number
): Promise<boolean> {
	const	signer = provider.getSigner();
	const	address = await signer.getAddress();

	try {
		const	contract = new ethers.Contract(
			ZAP_YEARN_VE_CRV_ADDRESS,
			['function zap(address _input, address _output, uint256 _amount, uint256 _minOut, address _recipient) external returns (uint256)'],
			signer
		);
		const	minAmountStr = Number(ethers.utils.formatUnits(minAmount, 18));
		const	minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
		const	transaction = await contract.zap(
			inputToken,
			outputToken,
			amount,
			minAmountWithSlippage,
			address
		);
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
