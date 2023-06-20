import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TWeeks} from '@yearn-finance/web-lib/utils/time';

export const YFI_ADDRESS: TAddress = toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e');
export const VEYFI_ADDRESS: TAddress = toAddress('0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5');
export const VEYFI_POSITION_HELPER_ADDRESS: TAddress = toAddress('0x5A70cD937bA3Daec8188E937E243fFa43d6ECbe8');
export const VEYFI_REGISTRY_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed

export const MAX_LOCK_TIME: TWeeks = 208;
export const MIN_LOCK_TIME: TWeeks = 1;
export const MIN_LOCK_AMOUNT: TWeeks = 1;

export const YEARN_SNAPSHOT_SPACE = 'veyfi.eth';
export const SNAPSHOT_DELEGATE_REGISTRY_ADDRESS = toAddress('0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446');
