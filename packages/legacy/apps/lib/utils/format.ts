import {formatUnits, parseUnits as vParseUnits} from 'viem';
import type {TNormalizedBN, TNumberish} from '../types/mixed';
import {MAX_UINT_256} from './constants';
import {isZero} from './tools.is';

export const DefaultTNormalizedBN: TNormalizedBN = {raw: 0n, normalized: 0, display: '0'};

export const toSafeAmount = (value: `${number}`, max: bigint, d = 18): bigint => {
	if (value === formatUnits(max || 0n, d)) {
		return max;
	}
	return parseUnits(value || '0', d);
};

export const toSafeValue = (v: string | number): number => {
	if (!v || v === 'NaN') {
		return 0;
	}
	return Number(v);
};

/***************************************************************************
 ** Bunch of function using the power of the browsers and standard functions
 ** to correctly format bigNumbers, currency and date
 **************************************************************************/
export const toBigInt = (amount?: TNumberish): bigint => {
	return BigInt(amount || 0);
};

export function toBigNumberAsAmount(bnAmount = 0n, decimals = 18, decimalsToDisplay = 2, symbol = ''): string {
	let locale = 'en-US';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	const locales = [];
	locales.push('en-US');
	locales.push(locale);

	let symbolWithPrefix = symbol;
	if (symbol.length > 0 && symbol !== '%') {
		symbolWithPrefix = ` ${symbol}`;
	}

	if (bnAmount === 0n) {
		return `0${symbolWithPrefix}`;
	}
	if (bnAmount === MAX_UINT_256) {
		return `∞${symbolWithPrefix}`;
	}

	const formatedAmount = formatUnits(bnAmount, decimals);
	return `${new Intl.NumberFormat([locale, 'en-US'], {
		minimumFractionDigits: 0,
		maximumFractionDigits: decimalsToDisplay
	}).format(Number(formatedAmount))}${symbolWithPrefix}`;
}

export const toNormalizedValue = (v: bigint, d?: number): number => {
	return Number(formatUnits(v, d ?? 18));
};

export const toNormalizedAmount = (v: bigint, d?: number): string => {
	return formatAmount(toNormalizedValue(v, d ?? 18), 6, 6);
};

export function toNormalizedBN(value: TNumberish, decimals: number): TNormalizedBN {
	return {
		raw: toBigInt(value),
		normalized: Number(formatUnits(toBigInt(value), decimals ?? 18)),
		display: formatUnits(toBigInt(value), decimals ?? 18)
	};
}
export const zeroNormalizedBN: TNormalizedBN = toNormalizedBN(0, 18);

export function fromNormalized(value: number | string, decimals = 18): bigint {
	return vParseUnits(eToNumber(String(value)), decimals);
}

export function parseUnits(value: TNumberish, decimals = 18): bigint {
	const valueAsNumber = Number(value);
	return vParseUnits(`${valueAsNumber}`, decimals);
}

export const formatBigNumberOver10K = (value: bigint): string => {
	if (toBigInt(value) > toBigInt(10000) * toBigInt(1e18)) {
		return formatAmount(toNormalizedValue(toBigInt(value), 18), 0, 0) ?? '';
	}
	return formatAmount(toNormalizedValue(toBigInt(value), 18)) ?? '';
};

type TAmountOptions = {
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
	displayDigits?: number;
	shouldDisplaySymbol?: boolean;
	shouldCompactValue?: boolean;
};

export type TAmount = {
	value: bigint | number;
	decimals: number | bigint;
	symbol?: string;
	options?: TAmountOptions;
};

type TFormatCurrencyWithPrecision = {
	amount: number;
	maxFractionDigits: number;
	intlOptions: Intl.NumberFormatOptions;
	locale: string;
	symbol: string;
};

export const defaultOptions: TAmountOptions = {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	displayDigits: 0,
	shouldDisplaySymbol: true,
	shouldCompactValue: true
};

function assertValidNumber(value: number | undefined, defaultValue: number, label: string): number {
	if (value === undefined) {
		return defaultValue;
	}
	if (value < 0) {
		console.warn(`formatAmount: ${label} should be positive.`);
		return defaultValue;
	}
	if (value > 18) {
		console.warn(`formatAmount: ${label} should be less than 18.`);
		return 18;
	}
	if (Number.isNaN(value)) {
		console.warn(`formatAmount: ${label} is NaN.`);
		return defaultValue;
	}
	if (!Number.isSafeInteger(value)) {
		console.warn(`formatAmount: ${label} should be an integer.`);
		return defaultValue;
	}
	return value;
}

function assignOptions(options?: TAmountOptions): TAmountOptions {
	if (!options) {
		return defaultOptions;
	}

	/**********************************************************************************************
	 ** We need to ensure that displayDigits is a valid number. It can be any positive integer
	 ** between 0 and 18. If the value is invalid, we display a warning and set the value to the
	 ** default value (0 or 18).
	 **********************************************************************************************/
	options.displayDigits = assertValidNumber(options?.displayDigits, 0, 'displayDigits');

	/**********************************************************************************************
	 ** We need to ensure that minimumFractionDigits is a valid number. It can be any positive
	 ** integer between 0 and 18. If the value is invalid, we display a warning and set the value to
	 ** the default value (2 or 18).
	 **********************************************************************************************/
	options.minimumFractionDigits = assertValidNumber(options?.minimumFractionDigits, 2, 'minimumFractionDigits');

	/**********************************************************************************************
	 ** We need to ensure that maximumFractionDigits is a valid number. It can be any positive
	 ** integer between 0 and 18. If the value is invalid, we display a warning and set the value to
	 ** the default value (2 or 18).
	 **********************************************************************************************/
	options.maximumFractionDigits = assertValidNumber(options?.maximumFractionDigits, 2, 'maximumFractionDigits');

	/**********************************************************************************************
	 ** We need to ensure that maximumFractionDigits is always bigger or equal to
	 ** minimumFractionDigits, otherwise we set them as equal.
	 **********************************************************************************************/
	if (options.maximumFractionDigits < options.minimumFractionDigits) {
		options.maximumFractionDigits = options.minimumFractionDigits;
	}

	options.shouldDisplaySymbol ??= true;
	options.shouldCompactValue ??= true;

	return options;
}

function formatCurrencyWithPrecision({
	amount,
	maxFractionDigits,
	intlOptions,
	locale,
	symbol
}: TFormatCurrencyWithPrecision): string {
	return new Intl.NumberFormat([locale, 'en-US'], {
		...intlOptions,
		maximumFractionDigits: Math.max(maxFractionDigits, intlOptions.maximumFractionDigits || maxFractionDigits)
	})
		.format(amount)
		.replace('EUR', symbol);
}

export function formatLocalAmount(amount: number, decimals: number, symbol: string, options: TAmountOptions): string {
	/**********************************************************************************************
	 ** Define the normalized elements.
	 ** We use a few tricks here to get the benefits of the intl package and correct formating no
	 ** matter the provided local.
	 ** - Fallback formatting is set to `fr-FR`
	 ** - If symbol is USD, then we will display as `123,79 $` or `$123.79` (US)
	 ** - If smbol is percent, then we will display as `12 %` or `12%` (US)
	 ** - If symbol is any other token, we will display as `123,79 USDC` or `USDC 123.79` (US)
	 **********************************************************************************************/
	let locale = 'en-US';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	const locales = [];
	locales.push('en-US');
	locales.push(locale);

	const {shouldDisplaySymbol, shouldCompactValue, ...rest} = options;
	const intlOptions: Intl.NumberFormatOptions = rest;
	let isPercent = false;
	if (symbol && shouldDisplaySymbol) {
		const uppercaseSymbol = String(symbol).toLocaleUpperCase();
		const symbolToFormat = uppercaseSymbol === 'USD' ? 'USD' : 'EUR';
		(intlOptions.style = uppercaseSymbol === 'PERCENT' ? 'percent' : 'currency'),
			(intlOptions.currency = symbolToFormat),
			(intlOptions.currencyDisplay = symbolToFormat === 'EUR' ? 'code' : 'narrowSymbol');
		isPercent = uppercaseSymbol === 'PERCENT';
	}

	if (isPercent && amount > 5 && shouldCompactValue) {
		return `> ${new Intl.NumberFormat([locale, 'en-US'], intlOptions).format(5).replace('EUR', symbol)}`;
	}

	/**********************************************************************************************
	 ** If the amount is above 10k, we will format it to short notation:
	 ** - 123947 would be `123,95 k` or  `123.95K` (US)
	 ** - 267839372 would be `267,84 M` or  `267.84M` (US)
	 **********************************************************************************************/
	if (amount > 10_000 && shouldCompactValue) {
		return new Intl.NumberFormat([locale, 'en-US'], {
			...intlOptions,
			notation: 'compact',
			compactDisplay: 'short'
		})
			.format(amount)
			.replace('EUR', symbol);
	}

	/**********************************************************************************************
	 ** If the amount is very small, we adjust the decimals to try to display something, up to
	 ** "decimals" number of decimals
	 **********************************************************************************************/
	if (amount < 0.01) {
		if (isPercent) {
			return formatCurrencyWithPrecision({amount, maxFractionDigits: 2, intlOptions, locale, symbol});
		}
		if (amount > 0.00000001) {
			return formatCurrencyWithPrecision({amount, maxFractionDigits: 8, intlOptions, locale, symbol});
		}
		if (amount > 0.000000000001) {
			return formatCurrencyWithPrecision({amount, maxFractionDigits: 12, intlOptions, locale, symbol});
		}
		return formatCurrencyWithPrecision({amount, maxFractionDigits: decimals, intlOptions, locale, symbol});
	}
	return new Intl.NumberFormat([locale, 'en-US'], intlOptions).format(amount).replace('EUR', symbol);
}

export function formatTAmount(props: TAmount): string {
	const {value} = props;
	const options = assignOptions(props.options);
	const decimals = assertValidNumber(Number(props.decimals), 18, 'decimals');
	let amount = 0;
	if (typeof value === 'bigint') {
		amount = toNormalizedValue(toBigInt(value), decimals);
	} else if (typeof value === 'number' && !Number.isNaN(value)) {
		amount = value;
	}

	if (isZero(amount)) {
		return formatLocalAmount(0, 0, props.symbol || '', options);
	}
	if (!Number.isFinite(amount)) {
		return '∞';
	}
	return formatLocalAmount(amount, decimals, props.symbol || '', options);
}

/***************************************************************************
 ** Bunch of function using the power of the browsers and standard functions
 ** to correctly format numbers, currency and date
 **************************************************************************/
export function formatAmount(
	amount: number | string,
	minimumFractionDigits = 2,
	maximumFractionDigits = 2,
	displayDigits = 0,
	options?: {
		locales?: string[];
	}
): string {
	let locale = 'en-US';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	const locales = [];
	if (options?.locales) {
		locales.push(...options.locales);
	}
	locales.push('en-US');
	locales.push(locale);
	if (maximumFractionDigits < minimumFractionDigits) {
		maximumFractionDigits = minimumFractionDigits;
	}
	if (!amount) {
		amount = 0;
	}
	if (typeof amount === 'string') {
		amount = Number(amount);
	}
	if (Number.isNaN(amount)) {
		amount = 0;
	}
	let formattedAmount = new Intl.NumberFormat(locales, {
		minimumFractionDigits,
		maximumFractionDigits
	}).format(amount);

	if (displayDigits > 0 && formattedAmount.length > displayDigits) {
		const leftSide = formattedAmount.slice(0, Math.ceil(displayDigits / 2));
		const rightSide = formattedAmount.slice(-Math.floor(displayDigits / 2));
		formattedAmount = `${leftSide}...${rightSide}`;
	}

	return formattedAmount;
}

export function parseAmount(stringNumber: string, providedLocales?: string[]): number {
	let locale = 'en-US';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	const locales = [];
	if (providedLocales) {
		locales.push(...providedLocales);
	}
	locales.push('en-US');
	locales.push(locale);

	const thousandSeparator = Intl.NumberFormat(locales)
		.format(11111)
		.replace(/\p{Number}/gu, '');
	const decimalSeparator = Intl.NumberFormat(locales)
		.format(1.1)
		.replace(/\p{Number}/gu, '');

	return parseFloat(
		stringNumber
			.replace(new RegExp('\\' + thousandSeparator, 'g'), '')
			.replace(new RegExp('\\' + decimalSeparator), '.')
	);
}

export function formatCurrency(amount: number, decimals = 2): string {
	let locale = 'fr-FR';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	return new Intl.NumberFormat([locale, 'en-US'], {
		style: 'currency',
		currency: 'USD',
		currencyDisplay: 'symbol',
		minimumFractionDigits: 0,
		maximumFractionDigits: decimals
	}).format(amount);
}

export function formatWithUnit(
	amount: number,
	minimumFractionDigits = 2,
	maximumFractionDigits = 2,
	options?: {
		locales?: string[];
	}
): string {
	let locale = 'fr-FR';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	if (maximumFractionDigits < minimumFractionDigits) {
		maximumFractionDigits = minimumFractionDigits;
	}
	return new Intl.NumberFormat(options?.locales || [locale, 'en-US'], {
		minimumFractionDigits,
		maximumFractionDigits,
		notation: 'compact',
		compactDisplay: 'short',
		unitDisplay: 'short'
	}).format(amount);
}

export function formatUSD(n: number, min = 2, max = 2): string {
	return `$${formatAmount(n || 0, min, max)}`;
}

export function formatPercent(n: number, min = 2, max = 2, upperLimit = 500): string {
	const safeN = n || 0;
	if (safeN > upperLimit) {
		return `≧ ${formatAmount(upperLimit, min, max)}%`;
	}
	return `${formatAmount(safeN || 0, min, max)}%`;
}

export const formatNumberOver10K = (n: number): string => {
	if (n >= 10000) {
		return formatAmount(n, 0, 0) ?? '';
	}
	return formatAmount(n) ?? '';
};

export function formatCounterValue(amount: number | string, price: number): string {
	if (!amount || !price) {
		return `$${formatAmount(0, 2, 2)}`;
	}

	const value = (Number(amount) || 0) * (price || 0);
	if (value > 10000) {
		return `$${formatAmount(value, 0, 0)}`;
	}
	return `$${formatAmount(value, 2, 2)}`;
}

export function formatCounterValueRaw(amount: number | string, price: number): string {
	if (!amount || !price) {
		return '';
	}
	const value = (Number(amount) || 0) * (price || 0);
	if (value > 10000) {
		return formatAmount(value, 0, 0);
	}
	return formatAmount(value, 2, 2);
}

/******************************************************************
 * Converts e-Notation Numbers to Plain Numbers
 ******************************************************************
 * @function eToNumber(number)
 * @version  1.00
 * @param   {e nottation Number} valid Number in exponent format.
 *          pass number as a string for very large 'e' numbers or with large fractions
 *          (none 'e' number returned as is).
 * @return  {string}  a decimal number string.
 * @author  Mohsen Alyafei
 * @date    17 Jan 2020
 * Note: No check is made for NaN or undefined input numbers.
 *
 *****************************************************************/
export function eToNumber(num: string): string {
	let sign = '';
	// Convert to string and handle negative sign
	num = String(num);
	if (num.charAt(0) === '-') {
		sign = '-';
		num = num.substring(1);
	}
	const arr = num.split(/[e]/gi);
	if (arr.length < 2) {
		return sign + num;
	}
	const dot = '.';
	let n = arr[0];
	const exp = +arr[1];
	// Remove leading zeros from n, then remove decimal point to get w
	n = n.replace(/^0+/, '');
	let w = n.replace(dot, '');
	const pos = n.split(dot)[1] ? n.indexOf(dot) + exp : w.length + exp;
	const L = pos - w.length;
	const s = '' + BigInt(w);
	w = exp >= 0 ? (L >= 0 ? s + '0'.repeat(L) : r()) : pos <= 0 ? '0' + dot + '0'.repeat(Math.abs(pos)) + s : r();
	const V = w.split(dot);
	if ((Number(V[0]) === 0 && Number(V[1]) === 0) || (+w === 0 && +s === 0)) {
		w = '0';
	} //** added 9/10/2021
	return sign + w;
	function r(): string {
		return w.replace(new RegExp(`^(.{${pos}})(.)`), `$1${dot}$2`);
	}
}
