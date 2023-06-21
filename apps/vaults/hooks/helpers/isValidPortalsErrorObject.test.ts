import {describe, expect, it} from 'vitest';
import {isValidPortalsErrorObject} from '@vaults/hooks/helpers/isValidPortalsErrorObject';

describe('isValidPortalsErrorObject', (): void => {
	it('returns false for null', (): void => {
		expect(isValidPortalsErrorObject(null)).toBe(false);
	});

	it('returns false for undefined', (): void => {
		expect(isValidPortalsErrorObject(undefined)).toBe(false);
	});

	it('returns false for non-object types', (): void => {
		expect(isValidPortalsErrorObject('string')).toBe(false);
		expect(isValidPortalsErrorObject(123)).toBe(false);
		expect(isValidPortalsErrorObject(true)).toBe(false);
	});

	it('returns false for object without response property', (): void => {
		expect(isValidPortalsErrorObject({})).toBe(false);
	});

	it('returns false for object with null or undefined response property', (): void => {
		expect(isValidPortalsErrorObject({response: null})).toBe(false);
		expect(isValidPortalsErrorObject({response: undefined})).toBe(false);
	});

	it('returns false for object with response property without data property', (): void => {
		expect(isValidPortalsErrorObject({response: {}})).toBe(false);
	});

	it('returns false for object with response property with null or undefined data property', (): void => {
		expect(isValidPortalsErrorObject({response: {data: null}})).toBe(false);
		expect(isValidPortalsErrorObject({response: {data: undefined}})).toBe(
			false
		);
	});

	it('returns false for object with response property with data property without message property', (): void => {
		expect(isValidPortalsErrorObject({response: {data: {}}})).toBe(false);
	});

	it('returns false for object with response property with data property with null or undefined message property', (): void => {
		expect(
			isValidPortalsErrorObject({response: {data: {message: null}}})
		).toBe(false);
		expect(
			isValidPortalsErrorObject({response: {data: {message: undefined}}})
		).toBe(false);
	});

	it('returns true for object with response property with data property with string message property', (): void => {
		expect(
			isValidPortalsErrorObject({response: {data: {message: 'test'}}})
		).toBe(true);
	});
});
