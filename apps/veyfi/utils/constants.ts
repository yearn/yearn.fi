import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {YFI_ADDRESS as MAINNET_YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TWeeks} from '@yearn-finance/web-lib/utils/time';

export const VEYFI_CHAIN_ID = 250; //TODO: change it to 1 - veYFI test

export const YFI_ADDRESS = toAddress('0x52Ca0fC251e7a28cf8E67357BCD3d771B105eCa9') || MAINNET_YFI_ADDRESS; // TODO: change to MAINNET_YFI_ADDRESS
export const VEYFI_REGISTRY_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed
export const VEYFI_CLAIM_REWARDS_ZAP_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed
export const VEYFI_OPTIONS_ADDRESS = toAddress('0x16A0cE5957642aDa37F58d5115E38fF3B0C30dc6'); //TODO: change it - veYFI test
export const VEYFI_DYFI_ADDRESS = toAddress('0xC85509a31F218e66A7151A48e218AD98469Cbf4A'); //TODO: change it - veYFI test

export const SNAPSHOT_DELEGATE_REGISTRY_ADDRESS = toAddress('0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446');
export const YEARN_SNAPSHOT_SPACE = 'veyfi.eth';

export const MAX_LOCK_TIME: TWeeks = 208;
export const MIN_LOCK_TIME: TWeeks = 1;
export const MIN_LOCK_AMOUNT: TWeeks = 1;

