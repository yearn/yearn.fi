import {z} from 'zod';
import {addressSchema} from '@common/schemas/custom/addressSchema';

export const yDaemonTokenSchema = z.object({
	address: addressSchema,
	name: z.string(),
	symbol: z.string(),
	decimals: z.number(),
	isVault: z.boolean(),
	underlyingTokens: z.array(addressSchema).optional()
});

export const yDaemonTokensSchema = z.record(addressSchema, yDaemonTokenSchema);

export type TYDaemonToken = z.infer<typeof yDaemonTokenSchema>;

export type TYDaemonTokens = z.infer<typeof yDaemonTokensSchema>;
