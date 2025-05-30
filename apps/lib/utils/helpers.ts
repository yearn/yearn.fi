import {encodeFunctionData, toHex} from 'viem';

import {toNormalizedBN} from './format';
import {isObject} from './tools.is';

import type {EncodeFunctionDataParameters, Hex} from 'viem';
import type {TAddress} from '../types';
import type {TSortDirection} from '../types/mixed';

/***************************************************************************
 ** Parse some markdown to get the associated rich content. Instead of using
 ** a md parser and add some heavy dependencies, just use regex to replace
 ** the strings to some class and inject that to the code.
 **************************************************************************/
export function parseMarkdown(markdownText: string): string {
	const htmlText = markdownText
		.replace(/\[(.*?)\]\((.*?)\)/gim, "<a class='link' target='_blank' href='$2'>$1</a>")
		.replace(/~~(.*?)~~/gim, "<span class='line-through'>$1</span>")
		.replace(/\*\*(.*?)\*\*/gim, "<span class='font-bold'>$1</span>");
	return htmlText.trim();
}

/***************************************************************************
 ** We use the clipboard API in order to copy some data to the user's
 ** clipboard.
 ** A toast is displayed to inform the user that the address has been
 ** copied.
 **************************************************************************/
export function copyToClipboard(value: string, callback: VoidFunction): void {
	try {
		navigator.clipboard.writeText(value);
		callback();
	} catch (error) {
		console.error(error);
	}
}

/***************************************************************************
 ** Used to slugify a string.
 ** Src: https://gist.github.com/mathewbyrne/1280286
 **************************************************************************/
export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w-]+/g, '') // Remove all non-word chars
		.replace(/--+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

/***************************************************************************
 ** Detect is we are running from an Iframe
 **************************************************************************/
export function isIframe(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	if (
		window !== window.top ||
		window.top !== window.self ||
		(document?.location?.ancestorOrigins || []).length !== 0
	) {
		return true;
	}
	return false;
}

/***************************************************************************
 ** Framer Motion animation constants
 **************************************************************************/
export const motionTransition = {duration: 0.4, ease: 'easeInOut'};
export const motionVariants = {
	initial: {y: -80, opacity: 0, motionTransition},
	enter: {y: 0, opacity: 1, motionTransition},
	exit: {y: -80, opacity: 0, motionTransition}
};

/***************************************************************************
 ** Helper function to sort elements based on the type of the element.
 **************************************************************************/
export const stringSort = ({a, b, sortDirection}: {a: string; b: string; sortDirection: TSortDirection}): number =>
	sortDirection === 'desc' ? a.localeCompare(b) : b.localeCompare(a);

export const numberSort = ({a, b, sortDirection}: {a?: number; b?: number; sortDirection: TSortDirection}): number =>
	sortDirection === 'desc' ? (b ?? 0) - (a ?? 0) : (a ?? 0) - (b ?? 0);

export const bigNumberSort = ({a, b, sortDirection}: {a: bigint; b: bigint; sortDirection: TSortDirection}): number =>
	Number(toNormalizedBN(sortDirection === 'desc' ? b - a : a - b, 18).normalized);

/***************************************************************************
 ** Helper function to deep merge two objects
 **************************************************************************/
export function deepMerge(target: unknown, source: unknown): unknown {
	if (!isObject(target) || !isObject(source)) {
		return target;
	}

	Object.keys(target).forEach((key: string | number): void => {
		const targetValue = target[key];
		target[key] = targetValue;
	});

	Object.keys(source).forEach((key: string | number): void => {
		const targetValue = target[key];
		const sourceValue = source[key];

		if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
			target[key] = sourceValue; //no concat, replace
		} else if (isObject(targetValue) && isObject(sourceValue)) {
			target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
		} else {
			target[key] = sourceValue;
		}
	});

	return target;
}

/***************************************************************************
 ** Helper function to encode the function call
 **************************************************************************/
type TEncodeFunctionCallArgs = {
	to: TAddress;
	value?: bigint;
} & EncodeFunctionDataParameters;

type TEncodeFunctionCallResp = {
	to: TAddress;
	value: Hex;
	data: Hex;
};
export function encodeFunctionCall(args: TEncodeFunctionCallArgs): TEncodeFunctionCallResp {
	const {to, value, ...rest} = args;

	return {
		to,
		value: toHex(value ?? 0n),
		data: encodeFunctionData(rest)
	};
}
