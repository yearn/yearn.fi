import {ethers, formatUnits, parseUnits} from 'ethers';
import {VLYCRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {MaxUint256} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import VLYCRV_ABI from './abi/vlYCrv.abi';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function vLyCRVDeposit(
	provider: TWeb3Provider,
	amount = MaxUint256
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return await handleTx(contract.deposit(amount));
}

export async function vLyCRVWithdraw(
	provider: TWeb3Provider,
	amount = MaxUint256
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return await handleTx(contract.withdraw(amount));
}

export async function vLyCRVVote(
	provider: TWeb3Provider,
	gaugeAddress: TAddress,
	votes: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return await handleTx(contract.vote(gaugeAddress, votes));
}

export async function vLyCRVVoteMany(
	provider: TWeb3Provider,
	gauges: TAddress[],
	votes: bigint[]
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI, signer);
	return await handleTx(contract.voteMany(gauges, votes));
}

export async function	addLiquidity(
	provider: TWeb3Provider,
	amount1: bigint,
	amount2: bigint,
	expectedAmount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(YVECRV_POOL_LP_ADDRESS, ['function add_liquidity(uint256[2], uint256)'], signer);
	const SLIPPAGE = 0.2;
	const minAmountStr = Number(formatUnits(expectedAmount, 18));
	const minAmountWithSlippage = parseUnits((minAmountStr * (1 - SLIPPAGE)).toFixed(18), 18);
	return await handleTx(contract.add_liquidity([amount1, amount2], minAmountWithSlippage));
}

export async function	zap(
	provider: TWeb3Provider,
	inputToken: string,
	outputToken: string,
	amount: bigint,
	minAmount: bigint,
	slippage: number
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const address = await signer.getAddress();
	const contract = new ethers.Contract(
		ZAP_YEARN_VE_CRV_ADDRESS,
		['function zap(address _input, address _output, uint256 _amount, uint256 _minOut, address _recipient) external returns (uint256)'],
		signer
	);
	const minAmountStr = Number(formatUnits(minAmount, 18));
	const minAmountWithSlippage = parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
	return await handleTx(contract.zap(inputToken, outputToken, amount, minAmountWithSlippage, address));
}
