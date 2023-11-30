import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TWeeks} from '@yearn-finance/web-lib/utils/time';

export const VEYFI_CHAIN_ID = 1;

export const VEYFI_REGISTRY_ADDRESS: TAddress = toAddress(''); // TODO: update once deployed
export const VEYFI_OPTIONS_ADDRESS = toAddress('0x2fBa208E1B2106d40DaA472Cb7AE0c6C7EFc0224');
export const VEYFI_DYFI_ADDRESS = toAddress('0x41252E8691e964f7DE35156B68493bAb6797a275');
export const VEYFI_ADDRESS = toAddress('0x90c1f9220d90d3966FbeE24045EDd73E1d588aD5');
export const VEYFI_POSITION_HELPER_ADDRESS = toAddress('0x5A70cD937bA3Daec8188E937E243fFa43d6ECbe8');
export const VEYFI_YFI_REWARD_POOL = toAddress('0xb287a1964AEE422911c7b8409f5E5A273c1412fA');
export const VEYFI_DYFI_REWARD_POOL = toAddress('0x2391Fc8f5E417526338F5aa3968b1851C16D894E');

export const SNAPSHOT_DELEGATE_REGISTRY_ADDRESS = toAddress('0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446');
export const YEARN_SNAPSHOT_SPACE = 'veyfi.eth';

export const SECONDS_PER_YEAR = 31556952;
export const MAX_LOCK_TIME: TWeeks = 208;
export const MIN_LOCK_TIME: TWeeks = 1;
export const MIN_LOCK_AMOUNT: TWeeks = 1;

export const VE_YFI_GAUGES = [
	toAddress('0x7Fd8Af959B54A677a1D8F92265Bd0714274C56a3'), // YFI/ETH yVault
	toAddress('0x28da6dE3e804bDdF0aD237CFA6048f2930D0b4Dc'), // dYFI/ETH yVault
	toAddress('0x107717C98C8125A94D3d2Cc82b86a1b705f3A27C'), // yCRV/CRV yVault
	toAddress('0x81d93531720d86f0491DeE7D03f30b3b5aC24e59'), // yETH/ETH yVault
	toAddress('0x6130E6cD924a40b24703407F246966D7435D4998')  // yPrisma/Prisma yVault
];
