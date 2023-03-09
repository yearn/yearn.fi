import type {TAddress} from '@yearn-finance/web-lib/types';
import type {Solver} from '@vaults/contexts/useSolver';

export type TYDaemonTokensList = {
	address: TAddress;
	decimals: bigint;
	chainID: number;
	name: string;
	symbol: string;
	logoURI: string;
	balance: string;
	supportedZaps: Solver[];
};
