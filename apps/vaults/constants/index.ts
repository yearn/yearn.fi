import {toAddress} from '@yearn-finance/web-lib/utils/address';

export const STAKING_REWARDS_SUPPORTED_CHAINS = [10];

// TODO: hardcoded until a registry is deployed
export const STAKING_REWARDS_ADDRESSES = [toAddress('0x1eC8BaAB7DBd6f5a02EfcAb711e765bF796d091c')];
export const STAKING_REWARDS_REGISTRY_ADDRESS = toAddress();

// eslint-disable-next-line @typescript-eslint/naming-convention
export const STAKING_REWARDS_ZAP_ENABLED = false;
export const STAKING_REWARDS_ZAP_ADDRESS = toAddress(); // TODO: update once deployed
