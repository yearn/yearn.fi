import {ethers} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import VLYCRV_ABI from './abi/vlYCrv.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function vLyCRVDeposit(
	provider: ethers.providers.JsonRpcProvider,
	amount = ethers.constants.MaxUint256
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return handleTx(contract.deposit(amount));
}

export async function vLyCRVWithdraw(
	provider: ethers.providers.JsonRpcProvider,
	amount = ethers.constants.MaxUint256
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return handleTx(contract.withdraw(amount));
}

export async function vLyCRVVote(
	provider: ethers.providers.JsonRpcProvider,
	gaugeAddress: TAddress,
	votes: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return handleTx(contract.vote(gaugeAddress, votes));
}

export async function vLyCRVVoteMany(
	provider: ethers.providers.JsonRpcProvider,
	gauges: TAddress[],
	votes: BigNumber[]
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return await handleTx(contract.voteMany(gauges, votes));
}

export async function	addLiquidity(
	provider: ethers.providers.JsonRpcProvider,
	amount1: BigNumber,
	amount2: BigNumber,
	expectedAmount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(YVECRV_POOL_LP_ADDRESS, ['function add_liquidity(uint256[2], uint256)'], signer);
	const SLIPPAGE = 0.2;
	const minAmountStr = Number(ethers.utils.formatUnits(expectedAmount, 18));
	const minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - SLIPPAGE)).toFixed(18), 18);
	return await handleTx(contract.add_liquidity([amount1, amount2], minAmountWithSlippage));
}

export async function	zap(
	provider: ethers.providers.JsonRpcProvider,
	inputToken: string,
	outputToken: string,
	amount: BigNumber,
	minAmount: BigNumber,
	slippage: number
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const address = await signer.getAddress();
	const contract = new ethers.Contract(
		ZAP_YEARN_VE_CRV_ADDRESS,
		['function zap(address _input, address _output, uint256 _amount, uint256 _minOut, address _recipient) external returns (uint256)'],
		signer
	);
	const minAmountStr = Number(ethers.utils.formatUnits(minAmount, 18));
	const minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
	return await handleTx(contract.zap(inputToken, outputToken, amount, minAmountWithSlippage, address));
}
