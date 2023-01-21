import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export function isAddress(value: string | TAddress): value is TAddress {
	return /^0x([0-9a-f][0-9a-f])*$/i.test(value);
}
