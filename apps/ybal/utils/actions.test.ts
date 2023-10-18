/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {describe, expect, it, vi} from 'vitest';
import {zapBal} from '@yBal/utils/actions';

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
});
