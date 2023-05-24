/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {ethers} from 'ethers';

import {zap} from './actions';

const mockZap = jest.fn();

jest.mock('ethers', () => ({
	ethers: {
		...jest.requireActual('ethers'),
		providers: {
			JsonRpcProvider: jest.fn().mockImplementation(() => ({
				getSigner: jest.fn().mockReturnValue({
					getAddress: jest.fn().mockReturnValue('0xRecipient')
				})
			}))
		},
		Contract: jest.fn().mockImplementation(() => ({
			zap: mockZap
		}))
	}
}));

jest.mock('@yearn-finance/web-lib/utils/web3/transaction', () => ({
	handleTx: jest.fn()
}));

describe('actions', () => {
	describe('zap', () => {
		it('should call zap with the correct arguments', async () => {
			const inputToken = '0xInputToken';
			const outputToken = '0xOutputToken';
			const amountIn = ethers.utils.parseEther('100'); // 100e18;
			const minOut = ethers.utils.parseEther('100'); // 100e18;
			const slippage = 2;
			const provider = new ethers.providers.JsonRpcProvider();
	
			await zap(provider, inputToken, outputToken, amountIn, minOut, slippage);
	
			expect(mockZap).toHaveBeenCalledWith(
				inputToken,
				outputToken,
				amountIn,
				ethers.utils.parseEther('98'), // 98e18;
				'0xRecipient',
				true
			);
		});
	});
});
