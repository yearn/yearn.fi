/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {assert, describe, it} from 'vitest';
import {exportedForTesting as T} from '@common/utils/format';

describe('test format', (): void => {
	it('is ok for assertValidNumber', (): void => {
		assert.equal(T.assertValidNumber(undefined, 22, ''), 22, 'Undefined should fallback to default value');
		assert.equal(T.assertValidNumber(-5, 10, ''), 10, 'Negative value should fallback to default value');
		assert.equal(T.assertValidNumber(20, 10, ''), 18, 'Value greater than 18 should be limited to 18');
		assert.equal(T.assertValidNumber(NaN, 10, ''), 10, 'NaN value should fallback to default value');
		assert.equal(T.assertValidNumber(10.5, 10, ''), 10, 'Non-integer value should fallback to default value');
		assert.equal(T.assertValidNumber(15, 10, ''), 15, 'Valid value should be returned as is');
		assert.equal(T.assertValidNumber(undefined, 0, ''), 0, 'Undefined should fallback to default value (0)');
		assert.equal(T.assertValidNumber(0, 10, ''), 0, 'Zero value should be returned as is');
		assert.equal(T.assertValidNumber(18, 10, ''), 18, 'Value equal to the upper limit (18) should be returned as is');
		assert.equal(T.assertValidNumber(17.5, 18, ''), 18, 'Floating-point value within the range should fallback');
		assert.equal(T.assertValidNumber(25, 10, ''), 18, 'Value greater than 18 should be limited to 18');
		assert.equal(T.assertValidNumber('abc' as any, 10, ''), 10, 'Invalid value should fallback to default value');
		assert.equal(T.assertValidNumber(10.7, 10, ''), 10, 'Non-integer value should fallback to default value');
		assert.equal(T.assertValidNumber(10.0, 10, ''), 10, 'Floating-point value with zero decimal should be returned as is');
		assert.equal(T.assertValidNumber(-20, 10, ''), 10, 'Negative value should fallback to default value');
		assert.equal(T.assertValidNumber(3, 10, ''), 3, 'Value within the range should be returned as is');
		assert.equal(T.assertValidNumber(7, 10, ''), 7, 'Value within the range should be returned as is');
		assert.equal(T.assertValidNumber(13, 10, ''), 13, 'Value within the range should be returned as is');
		assert.equal(T.assertValidNumber(18, 10, ''), 18, 'Value equal to the upper limit (18) should be returned as is');
		assert.equal(T.assertValidNumber(-1, 7, ''), 7, 'Negative value should fallback to default value');
		assert.equal(T.assertValidNumber(1.5, 10, ''), 10, 'Floating-point value within the range should fallback');
	});

	it('is ok for formatLocalAmount', (): void => {
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, '$', T.defaultOptions).normalize('NFKC'),
			'1 234,57 $',
			'Currency symbol should be displayed'
		);
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, '$', T.defaultOptions).normalize('NFKC'),
			'1 234,57 $',
			'Currency symbol should be displayed'
		);
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, 'USD', T.defaultOptions).normalize('NFKC'),
			'1 234,57 $',
			'USD currency symbol should be displayed'
		);
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, 'DAI', T.defaultOptions).normalize('NFKC'),
			'1 234,57 DAI',
			'DAI currency symbol should be displayed'
		);
		assert.equal(
			T.formatLocalAmount(0.123, 2, 'PERCENT', T.defaultOptions).normalize('NFKC'),
			'12,30 %',
			'Percent symbol should be displayed'
		);
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, '', T.defaultOptions).normalize('NFKC'),
			'1 234,57',
			'Empty symbol should not affect formatting'
		);
		assert.equal(
			T.formatLocalAmount(1234.5678, 2, '', {shouldDisplaySymbol: false}).normalize('NFKC'),
			'1 234,568',
			'Empty symbol should not affect formatting'
		);
		assert.equal(
			T.formatLocalAmount(12345.6789, 2, '$', T.defaultOptions).normalize('NFKC'),
			'12,35 k $',
			'Amount should be formatted in short notation'
		);
		assert.equal(
			T.formatLocalAmount(12345678.9, 2, 'USD', T.defaultOptions).normalize('NFKC'),
			'12,35 M $',
			'Amount should be formatted in short notation'
		);
		assert.equal(
			T.formatLocalAmount(0.00000123, 8, '$', T.defaultOptions).normalize('NFKC'),
			'0,00000123 $',
			'Amount should be formatted with the specified number of decimals'
		);
		assert.equal(
			T.formatLocalAmount(0.00000000123, 12, 'USD', T.defaultOptions).normalize('NFKC'),
			'0,00000000123 $',
			'Amount should be formatted with the specified number of decimals'
		);
		assert.equal(
			T.formatLocalAmount(0.01, 2, 'USD', T.defaultOptions).normalize('NFKC'),
			'0,01 $',
			'Amount above 0.01 should be formatted as is'
		);
		assert.equal(
			T.formatLocalAmount(0.001, 2, 'OPT', T.defaultOptions).normalize('NFKC'),
			'0,001 OPT',
			'Amount above 0.01 should be formatted as is'
		);
		assert.equal(
			T.formatLocalAmount(0.000000000000123, 18, 'YFI', T.defaultOptions).normalize('NFKC'),
			'0,000000000000123 YFI',
			'Amount should be formatted with the specified number of decimals'
		);
		assert.equal(
			T.formatLocalAmount(0.000000000000000000123, 18, 'YFI', T.defaultOptions).normalize('NFKC'),
			'0,00 YFI',
			'Amount should be 0,00 YFI when it's too small'
		);
	});

	it('is ok for amount', (): void => {
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: '$', options: T.defaultOptions}).normalize('NFKC'),
			'1 234,57 $',
			'Formatted amount with decimal places and currency symbol should be returned'
		);
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: 'USD', options: T.defaultOptions}).normalize('NFKC'),
			'1 234,57 $',
			'Formatted amount with decimal places and USD currency symbol should be returned'
		);
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: 'DAI', options: T.defaultOptions}).normalize('NFKC'),
			'1 234,57 DAI',
			'Formatted amount with decimal places and EUR currency symbol should be returned'
		);
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: 'USD', options: {shouldDisplaySymbol: false}}).normalize('NFKC'),
			'1 234,57',
			'Formatted amount with decimal places and no currency symbol should be returned'
		);
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: 'PERCENT', options: T.defaultOptions}).normalize('NFKC'),
			'> 500,00 %',
			'Formatted amount with decimal places and percent symbol should be returned'
		);
		assert.equal(
			T.amount({value: 1234.5678, decimals: 2, symbol: 'PERCENT', options: {shouldDisplaySymbol: false}}).normalize('NFKC'),
			'1 234,57',
			'Formatted amount with decimal places and no percent symbol should be returned'
		);
		assert.equal(
			T.amount({value: 0, decimals: 2, symbol: '', options: T.defaultOptions}).normalize('NFKC'),
			'0,00',
			'Formatted zero amount with no symbol should be returned'
		);
		assert.equal(
			T.amount({value: Infinity, decimals: 2, symbol: '$', options: T.defaultOptions}).normalize('NFKC'),
			'∞',
			'Formatted infinity amount should be returned'
		);
		assert.equal(
			T.amount({value: BigInt(123456789), decimals: 2, symbol: '$', options: T.defaultOptions}).normalize('NFKC'),
			'1,23 M $',
			'Formatted BigInt amount with unit should be returned'
		);
		assert.equal(
			T.amount({value: NaN, decimals: 2, symbol: '$', options: T.defaultOptions}).normalize('NFKC'),
			'0,00 $',
			'Formatted NaN amount should return infinity'
		);
		assert.equal(
			T.amount({value: 0.0000000012345678, decimals: 2, symbol: 'PERCENT', options: {shouldDisplaySymbol: false}}).normalize('NFKC'),
			'0,000000001235',
			'Formatted small amount with decimal places and no percent symbol should be returned'
		);
		assert.equal(
			T.amount({value: 0.000000000000012345678, decimals: 2, symbol: 'PERCENT', options: {shouldDisplaySymbol: false}}).normalize('NFKC'),
			'0,00',
			'Format small amount to 0,00 and no percent symbol should be returned'
		);
	});
});
