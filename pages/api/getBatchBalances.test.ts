import {describe, expect, it} from 'vitest';

import {isArrayOfUseBalancesTokens} from './getBatchBalances';

import type {TUseBalancesTokens} from '@common/hooks/useBalances';

describe('isArrayOfUseBalancesTokens', (): void => {
	it('should return true for valid TUseBalancesTokens array', (): void => {
		const validData: TUseBalancesTokens[] = [
			{token: 'token1'},
			{token: 'token2', for: 'for2'},
			{token: 'token3', for: 'for3'}
		];
		expect(isArrayOfUseBalancesTokens(validData)).toBe(true);
	});

	it('should return false for an array including an item without a token', (): void => {
		const invalidData: (TUseBalancesTokens | object)[] = [
			{token: 'token1'},
			{},
			{token: 'token2', for: 'for2'}
		];
		expect(isArrayOfUseBalancesTokens(invalidData)).toBe(false);
	});

	it('should return false for an array including an item where token is not a string', (): void => {
		const invalidData: unknown[] = [
			{token: 'token1'},
			{token: 123},
			{token: 'token2', for: 'for2'}
		];
		expect(isArrayOfUseBalancesTokens(invalidData)).toBe(false);
	});

	it('should return false for non-array input', (): void => {
		const nonArrayInput: unknown = 'not an array';
		expect(isArrayOfUseBalancesTokens(nonArrayInput)).toBe(false);
	});

	it('should return false for undefined input', (): void => {
		expect(isArrayOfUseBalancesTokens(undefined)).toBe(false);
	});
});
