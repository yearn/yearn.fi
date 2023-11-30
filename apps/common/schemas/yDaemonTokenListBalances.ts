import {z} from 'zod';
import {addressSchema} from '@yearn-finance/web-lib/utils/schemas/addressSchema';

import type {TDict, TNDict} from '@yearn-finance/web-lib/types';

const SOLVER = [
	'Vanilla',
	'PartnerContract',
	'ChainCoin',
	'InternalMigration',
	'OptimismBooster',
	'Cowswap',
	'Portals',
	'Wido',
	'None'
] as const;

export const Solver = z.enum(SOLVER);

export type TSolver = z.infer<typeof Solver>;

const yDaemonTokenListBalance = z.object({
	chainID: z.number().optional(),
	decimals: z.number(),
	address: z.string(),
	name: z.string(),
	symbol: z.string(),
	logoURI: z.string().optional(),
	balance: z.string().optional(),
	price: z.string().optional(),
	supportedZaps: Solver.array().optional()
});

export const _yDaemonTokenListBalances = z.record(addressSchema, yDaemonTokenListBalance);
export const yDaemonTokenListBalances = z.record(z.string(), _yDaemonTokenListBalances);
export type TYDaemonTokenListBalances = TNDict<TDict<z.infer<typeof yDaemonTokenListBalance>>>;
export type TSupportedZaps = z.infer<typeof Solver>;
