import {z} from 'zod';
import {addressSchema} from '@yearn-finance/web-lib/utils/schemas/addressSchema';

export const yDaemonTokenSchema = z.object({
	address: addressSchema,
	name: z.string(),
	symbol: z.string(),
	decimals: z.number(),
	isVault: z.boolean(),
	underlyingTokens: z.array(addressSchema).optional()
});

export const yDaemonTokensSchema = z.record(addressSchema, yDaemonTokenSchema);
export const yDaemonTokensChainSchema = z.record(z.string(), yDaemonTokensSchema);

export type TYDaemonToken = z.infer<typeof yDaemonTokenSchema>;
export type TYDaemonTokens = z.infer<typeof yDaemonTokensSchema>;
export type TYDaemonTokensChain = z.infer<typeof yDaemonTokensChainSchema>;
