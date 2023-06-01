/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {createWalletClient, http, parseEther} from 'viem';
import {describe, expect, it, vi} from 'vitest';
import {MockConnector} from '@wagmi/core/connectors/mock';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {simulateZapForMinOut, zapBal} from '@yBal/utils/actions';

import type {TAddress} from '@yearn-finance/web-lib/types';

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');

const mockZap = vi.fn();
const mockCallStaticZap = vi.fn();

// const mockMintBuffer = vi.fn().mockReturnValue(toBigInt('5'));

// vi.mock('ethers', async () => {
// 	const actual = await vi.importActual<typeof ethers>('ethers');
// 	return {
// 		ethers: {
// 			...actual,
// 			providers: {
// 				JsonRpcProvider: vi.fn().mockImplementation(() => ({
// 					getSigner: vi.fn().mockReturnValue({
// 						getAddress: vi.fn().mockReturnValue('0xRecipient')
// 					})
// 				}))
// 			},
// 			Contract: vi.fn().mockImplementation(() => ({
// 				zap: mockZap,
// 				callStatic: {
// 					queryZapOutput: mockCallStaticZap
// 				},
// 				mint_buffer: mockMintBuffer
// 			}))
// 		},
// 		BigNumber: actual.BigNumber
// 	};
// });

vi.mock('@yearn-finance/web-lib/utils/web3/transaction', () => ({
	handleTx: vi.fn()
}));


describe('actions', () => {
	it('should export the correct actions', () => {
		expect(zapBal).toBeDefined();
	});
	return;

	//TODO: update tests
	describe('simulateZapForMinOut', () => {
		describe('when buffered amount is greater than expected amount mint', () => {
			it('should use the bufferedAmount for min out', async () => {
				const EXPECTED_AMOUNT_MINT = parseEther('100'); // 100e18
				const EXPECTED_AMOUNT_SWAP = parseEther('200'); // 200e18

				mockCallStaticZap
					.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
					.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

				const inputToken = BAL_TOKEN_ADDRESS as TAddress;
				const outputToken = YBAL_TOKEN_ADDRESS as TAddress;
				const amountIn = parseEther('500'); // 500e18
				const connector = new MockConnector({
					options: {
						walletClient: createWalletClient({
							transport: http('http://localhost:8545')
						})
					}
				});
				const {shouldMint, minOut} = await simulateZapForMinOut({
					connector: connector,
					contractAddress: ZAP_YEARN_YBAL_ADDRESS,
					inputToken: inputToken,
					outputToken: outputToken,
					amountIn: amountIn
				});

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(1, BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, amountIn, true);
				expect(mockCallStaticZap).toHaveBeenNthCalledWith(2, BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, amountIn, false);
				expect(shouldMint).toBe(false);
				expect(minOut).toEqual(toBigInt('197752499999999997726'));
			});
		});

		describe('when buffered amount is less or equal to expected amount mint', () => {
			it('should use the expected amount mint for min out', async () => {
				const EXPECTED_AMOUNT_MINT = parseEther('42'); // 42e18
				const EXPECTED_AMOUNT_SWAP = parseEther('42'); // 42e18

				mockCallStaticZap
					.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
					.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

				const inputToken = BAL_TOKEN_ADDRESS as TAddress;
				const outputToken = YBAL_TOKEN_ADDRESS as TAddress;
				const amountIn = parseEther('400'); // 400e18
				const expectedIn = parseEther('500');
				const connector = new MockConnector({
					options: {
						walletClient: createWalletClient({
							transport: http('http://localhost:8545')
						})
					}
				});
				const {shouldMint, minOut} = await simulateZapForMinOut({
					connector: connector,
					contractAddress: ZAP_YEARN_YBAL_ADDRESS,
					inputToken: inputToken,
					outputToken: outputToken,
					amountIn: amountIn
				});

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(1, BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, expectedIn, true);
				expect(mockCallStaticZap).toHaveBeenNthCalledWith(2, BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, expectedIn, false);
				expect(shouldMint).toBe(true);
				expect(minOut).toEqual(toBigInt('41579999999999998295'));
			});
		});
	});

	describe('zap', () => {
		it('should call zap with the correct arguments', async () => {
			const inputToken = BAL_TOKEN_ADDRESS;
			const outputToken = YBAL_TOKEN_ADDRESS;
			const amountIn = parseEther('100'); // 100e18;
			const minOut = parseEther('100'); // 100e18;
			const slippage = 2;
			const connector = new MockConnector({
				options: {
					walletClient: createWalletClient({
						transport: http('http://localhost:8545')
					})
				}
			});

			await zapBal({
				connector: connector,
				contractAddress: LOCAL_ZAP_YEARN_YBAL_ADDRESS,
				inputToken: inputToken,
				outputToken: outputToken,
				amount: amountIn,
				minAmount: minOut,
				slippage: toBigInt(slippage),
				shouldMint: true
			});

			expect(mockZap).toHaveBeenCalledWith(
				BAL_TOKEN_ADDRESS,
				YBAL_TOKEN_ADDRESS,
				toBigInt('100000000000000000000'),
				toBigInt('98000000000000000000'),
				(await connector.getAccount()),
				true
			);
		});
	});
});
