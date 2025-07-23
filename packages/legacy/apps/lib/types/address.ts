import {z} from 'zod';

/*******************************************************************************
 ** TAddress is used to represent a checksummed address
 ******************************************************************************/
export type TAddressSmol = '/^0x[0-9a-f]{40}$/i';
export type TAddressWagmi = `0x${string}`;
export type TAddress = TAddressWagmi;
export type TAddressLike = TAddressSmol | TAddressWagmi | string;

export const ADDRESS_REGEX = new RegExp(/^0x[0-9a-f]{40}$/i);

export const addressSchema = z.custom<TAddress>((val): boolean => {
	return ADDRESS_REGEX.test(val as TAddress);
});
