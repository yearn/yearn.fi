/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {ethers} from 'ethers';

import {simulateZapForMinOut, zap} from './actions';
import { TAddress } from '@yearn-finance/web-lib/types';

const MINT_BUFFER = ethers.BigNumber.from('5');

const mockZap = jest.fn();
const mockCallStaticZap = jest.fn();
const mockMintBuffer = jest.fn().mockReturnValue(MINT_BUFFER);

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
			zap: mockZap,
			callStatic: {
				zap: mockCallStaticZap
			},
			mint_buffer: mockMintBuffer
		}))
	}
}));

jest.mock('@yearn-finance/web-lib/utils/web3/transaction', () => ({
	handleTx: jest.fn()
}));

describe('actions', () => {
	describe('simulateZapForMinOut', () => {
		beforeEach(() => {
			mockCallStaticZap.mockReset();
		});

		describe('when buffered amount is greater than expected amount mint', () => {
			it('should use the bufferedAmount for min out', async () => {
				const EXPECTED_AMOUNT_MINT = ethers.utils.parseEther('100'); // 100e18
				const EXPECTED_AMOUNT_SWAP = ethers.utils.parseEther('200'); // 200e18

				mockCallStaticZap
					.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
					.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

				const inputToken = '0xInputToken' as TAddress;
				const outputToken = '0xOutputToken' as TAddress;
				const amountIn = ethers.utils.parseEther('500'); // 500e18
				const provider = new ethers.providers.JsonRpcProvider();
			
				const {mint, minOut} = await simulateZapForMinOut(provider, inputToken, outputToken, amountIn);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(1,
					"0xInputToken", "0xOutputToken", "500000000000000000000", 0, "0xRecipient", true
				);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(2,
					"0xInputToken", "0xOutputToken", ethers.BigNumber.from("500000000000000000000"), 0, "0xRecipient", false
				);
			
				expect(mint).toBe(false);

				expect(minOut).toEqual(ethers.BigNumber.from('197752499999999997726'));
			})
		});

		describe('when buffered amount is less or equal to expected amount mint', () => {
			it('should use the expected amount mint for min out', async () => {
				const EXPECTED_AMOUNT_MINT = ethers.utils.parseEther('42'); // 42e18
				const EXPECTED_AMOUNT_SWAP = ethers.utils.parseEther('42'); // 42e18

				mockCallStaticZap
					.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
					.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

				const inputToken = '0xInputToken' as TAddress;
				const outputToken = '0xOutputToken' as TAddress;
				const amountIn = ethers.utils.parseEther('400'); // 400e18
				const provider = new ethers.providers.JsonRpcProvider();
			
				const {mint, minOut} = await simulateZapForMinOut(provider, inputToken, outputToken, amountIn);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(1,
					"0xInputToken", "0xOutputToken", "400000000000000000000", 0, "0xRecipient", true
				);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(2,
					"0xInputToken", "0xOutputToken", ethers.BigNumber.from("400000000000000000000"), 0, "0xRecipient", false
				);
			
				expect(mint).toBe(true);

				expect(minOut).toEqual(ethers.BigNumber.from('41579999999999998295'));
			})
		});
	});

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
				'0xInputToken',
				'0xOutputToken',
				ethers.BigNumber.from('100000000000000000000'),
				ethers.BigNumber.from('98000000000000000000'),
				'0xRecipient',
				true
			);
		});
	});
});
