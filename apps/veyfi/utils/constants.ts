
import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TWeeks} from '@yearn-finance/web-lib/utils/time';

export const VEYFI_REGISTRY_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed
export const VEYFI_CLAIM_REWARDS_ZAP_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed

export const MAX_LOCK_TIME: TWeeks = 208;
export const MIN_LOCK_TIME: TWeeks = 1;
export const MIN_LOCK_AMOUNT: TWeeks = 1;

export const YEARN_SNAPSHOT_SPACE = 'veyfi.eth';
export const SNAPSHOT_DELEGATE_REGISTRY_ADDRESS = toAddress('0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446');
