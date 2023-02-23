import type {Solver} from '@vaults/contexts/useSolver';

export type TYDaemonTokensList = {
	chainID: number;
	address: string;
	name: string;
	symbol: string;
	logoURI: string;
	decimals: number;
	balance: string;
	supportedZaps: Solver[];
};
