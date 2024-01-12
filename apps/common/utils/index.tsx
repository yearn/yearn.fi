import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export function getVaultName(vault: TYDaemonVault): string {
	const baseName = vault.name;
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
}

export function formatDateShort(value: number): string {
	let locale = 'fr-FR';
	if (typeof navigator !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}

	return new Intl.DateTimeFormat([locale, 'en-US'], {
		year: 'numeric',
		month: 'short',
		day: '2-digit'
	}).format(value);
}

/* 🔵 - Yearn Finance **************************************************************************
 **	Returns an object composed of each element of an array, using one of the elements
 **  properties as its key
 **********************************************************************************************/
export const keyBy = <T1, T2 extends keyof T1 & string>(array: T1[], key: T2): TDict<T1 | undefined> =>
	(array || []).reduce((r, x): TDict<T1> => ({...r, [x[key] as string]: x}), {});

export async function hash(message: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8); // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
	const hashHex = hashArray.map((b): string => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return `0x${hashHex}`;
}
