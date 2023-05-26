/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {generateTestingUtils} from 'eth-testing';
import {ethers} from 'ethers';
import {describe, expect, it, vi} from 'vitest';
import {BAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {simulateZapForMinOut} from '@yBal/utils/actions';


beforeEach(async (): Promise<void> => {
	await vi.doMock('ethers', async () => {
		const ethers = await vi.importActual('ethers');
		return {
			...ethers as any,
			// providers: {
			// 	JsonRpcProvider: vi.fn().mockImplementation(() => ({
			// 		getSigner: vi.fn().mockReturnValue({
			// 			getAddress: vi.fn().mockReturnValue('0xRecipient')
			// 		})
			// 	}))
			// },
			Contract: vi.fn().mockImplementation(() => ({
				red: 'blue',
				zap: vi.fn(),
				callStatic: {
					queryZapOutput: vi.fn()
				},
				mint_buffer: vi.fn()
			}))
		};
	});
});

// vi.mock('ethers', async (importOriginal) => {
// 	const mod = await importOriginal();
// 	return {
// 		...mod as typeof ethers,
// 		providers: {
// 			JsonRpcProvider: vi.fn().mockImplementation(() => ({
// 				getSigner: vi.fn().mockReturnValue({
// 					getAddress: vi.fn().mockReturnValue('0xRecipient')
// 				})
// 			}))
// 		},
// 		Contract: vi.fn().mockImplementation(() => ({
// 			zap: mockZap,
// 			callStatic: {
// 				queryZapOutput: mockCallStaticZap
// 			},
// 			mint_buffer: mockMintBuffer
// 		}))
// 	};
// });

// vi.mock('ethers', () => ({
// 	ethers: {
// 		...ethers,
// 		providers: {
// 			JsonRpcProvider: vi.fn().mockImplementation(() => ({
// 				getSigner: vi.fn().mockReturnValue({
// 					getAddress: vi.fn().mockReturnValue('0xRecipient')
// 				})
// 			}))
// 		},
// 		Contract: vi.fn().mockImplementation(() => ({
// 			zap: mockZap,
// 			callStatic: {
// 				queryZapOutput: mockCallStaticZap
// 			},
// 			mint_buffer: mockMintBuffer
// 		}))
// 	}
// }));

vi.mock('@yearn-finance/web-lib/utils/web3/transaction', () => ({
	handleTx: vi.fn()
}));


describe('actions', () => {
	describe('simulateZapForMinOut', () => {
		describe('when buffered amount is greater than expected amount mint', () => {
			it('should use the bufferedAmount for min out', async () => {
				const testingUtils = generateTestingUtils({providerType: 'default'});

				const EXPECTED_AMOUNT_MINT = ethers.utils.parseEther('100'); // 100e18
				const EXPECTED_AMOUNT_SWAP = ethers.utils.parseEther('200'); // 200e18

				const mockCallStaticZap = vi.fn()
					.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
					.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

				const inputToken = BAL_TOKEN_ADDRESS;
				const outputToken = YBAL_TOKEN_ADDRESS;
				const amountIn = ethers.utils.parseEther('500'); // 500e18
				const randomWallet = ethers.Wallet.createRandom();
				testingUtils.mockNotConnectedWallet();
				testingUtils.mockRequestAccounts([randomWallet.address], {
					balance: '0x1bc16d674ec80000'
				});
				const provider = new ethers.providers.Web3Provider(testingUtils.getProvider());
				provider.getSigner = vi.fn().mockReturnValue({
					...provider.getSigner(),
					getAddress: vi.fn().mockReturnValue(randomWallet.address),
					call: vi.fn().mockReturnValue(ethers.utils.parseEther('100'))
				});


				const {shouldMint, minOut} = await simulateZapForMinOut(provider, inputToken, outputToken, amountIn);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(1,
					inputToken, outputToken, '500000000000000000000', true
				);

				expect(mockCallStaticZap).toHaveBeenNthCalledWith(2,
					inputToken, outputToken, ethers.BigNumber.from('500000000000000000000'), false
				);

				expect(shouldMint).toBe(false);

				expect(minOut).toEqual(ethers.BigNumber.from('197752499999999997726'));
			});
		});

		// describe('when buffered amount is less or equal to expected amount mint', () => {
		// 	it('should use the expected amount mint for min out', async () => {
		// 		const EXPECTED_AMOUNT_MINT = ethers.utils.parseEther('42'); // 42e18
		// 		const EXPECTED_AMOUNT_SWAP = ethers.utils.parseEther('42'); // 42e18

		// 		mockCallStaticZap
		// 			.mockReturnValueOnce(EXPECTED_AMOUNT_MINT)
		// 			.mockReturnValueOnce(EXPECTED_AMOUNT_SWAP);

		// 		const inputToken = '0xInputToken' as TAddress;
		// 		const outputToken = '0xOutputToken' as TAddress;
		// 		const amountIn = ethers.utils.parseEther('400'); // 400e18
		// 		const provider = new ethers.providers.JsonRpcProvider();

		// 		const {shouldMint, minOut} = await simulateZapForMinOut(provider, inputToken, outputToken, amountIn);

		// 		expect(mockCallStaticZap).toHaveBeenNthCalledWith(1,
		// 			'0xInputToken', '0xOutputToken', '400000000000000000000', true
		// 		);

		// 		expect(mockCallStaticZap).toHaveBeenNthCalledWith(2,
		// 			'0xInputToken', '0xOutputToken', ethers.BigNumber.from('400000000000000000000'), false
		// 		);

		// 		expect(shouldMint).toBe(true);

		// 		expect(minOut).toEqual(ethers.BigNumber.from('41579999999999998295'));
		// 	});
		// });
	});

	// describe('zap', () => {
	// 	it('should call zap with the correct arguments', async () => {
	// 		const inputToken = '0xInputToken';
	// 		const outputToken = '0xOutputToken';
	// 		const amountIn = ethers.utils.parseEther('100'); // 100e18;
	// 		const minOut = ethers.utils.parseEther('100'); // 100e18;
	// 		const slippage = 2;
	// 		const provider = new ethers.providers.JsonRpcProvider();

	// 		await zap(provider, inputToken, outputToken, amountIn, minOut, slippage);

	// 		expect(mockZap).toHaveBeenCalledWith(
	// 			'0xInputToken',
	// 			'0xOutputToken',
	// 			ethers.BigNumber.from('100000000000000000000'),
	// 			ethers.BigNumber.from('98000000000000000000'),
	// 			'0xRecipient',
	// 			true
	// 		);
	// 	});
	// });
});
