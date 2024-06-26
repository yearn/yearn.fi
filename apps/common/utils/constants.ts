import {toAddress} from '@builtbymom/web3/utils';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;
export const YGAUGES_ZAP_ADDRESS = toAddress('0x1104215963474A0FA0Ac09f4E212EF7282F2A0bC'); //Address of the zap to deposit & stake in the veYFI gauge
export const V3_STAKING_ZAP_ADDRESS = toAddress('0x42Ef144bA6F7eD11b7E8f6CFDF579DEBAf1CE041'); //Address of the zap to deposit & stake for the v3 staking on arbitrum
