import {z} from 'zod';
import {Solver} from '@vaults/contexts/useSolver';
import {addressSchema} from '@common/schemas/custom/addressSchema';

const yDaemonTokenListBalance = z.object({
	chainID: z.number().optional(),
	decimals: z.number(),
	address: z.string(),
	name: z.string(),
	symbol: z.string(),
	logoURI: z.string().optional(),
	balance: z.string().optional(),
	price: z.string().optional(),
	supportedZaps: z.nativeEnum(Solver).array().optional()
});

export const yDaemonTokenListBalances = z.record(addressSchema, yDaemonTokenListBalance);

export type TYDaemonTokenListBalances = z.infer<typeof yDaemonTokenListBalances>;
