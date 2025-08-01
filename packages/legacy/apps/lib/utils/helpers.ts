import {yToast} from '@lib/components/yToast';
import type {TAddress} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {EncodeFunctionDataParameters, Hex} from 'viem';
import {encodeFunctionData, toHex} from 'viem';
import type {TSortDirection} from '../types/mixed';
import {toNormalizedBN} from './format';
import {isObject} from './tools.is';

export function getVaultName(vault: TYDaemonVault): string {
	const baseName = vault.name;
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
}

export async function hash(message: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8); // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
	const hashHex = hashArray.map((b): string => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return `0x${hashHex}`;
}

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

export function copyToClipboard(value: string): void {
	const {toast} = yToast();
	navigator.clipboard.writeText(value);
	toast({content: 'Copied to clipboard!', type: 'info'});
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
			target[key] = deepMerge({...targetValue}, sourceValue);
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

/* 🔵 - Yearn Finance ******************************************************
 ** allowanceKey is used to access the unique allowance key matching one
 ** token with one spender
 **************************************************************************/
export function allowanceKey(chainID: number, token: TAddress, spender: TAddress, owner: TAddress): string {
	return `${chainID}_${token}_${spender}_${owner}`;
}
/**
 * Replace multiple string instances in a single string
 * @param inputString
 * @param stringsToReplace
 * @param replacement
 */

export const replaceStrings = (inputString: string, stringsToReplace: string[], replacement: string): string => {
	return stringsToReplace.reduce((outputString, stringToReplace) => {
		const regex = new RegExp(stringToReplace, 'g');
		return outputString.replace(regex, replacement);
	}, inputString);
};
