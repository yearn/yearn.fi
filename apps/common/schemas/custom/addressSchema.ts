import {z} from 'zod';

import type {TAddress} from '@yearn-finance/web-lib/types';

export const ADDRESS_REGEX = new RegExp(/^0x[0-9a-f]{40}$/i);

// TODO Change in web-lib the address type to have the regex /^0x[0-9a-f]{40}$/i
export const addressSchema = z.custom<TAddress>((val): boolean => {
	return ADDRESS_REGEX.test(val as TAddress);
});
