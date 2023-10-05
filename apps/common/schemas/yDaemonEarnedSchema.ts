import {z} from 'zod';
import {addressSchema} from '@yearn-finance/web-lib/utils/schemas/addressSchema';

export const yDaemonSingleEarnedSchema = z.object({
	earned: z.record(
		addressSchema,
		z.object({
			realizedGains: z.string(),
			realizedGainsUSD: z.number(),
			unrealizedGains: z.string(),
			unrealizedGainsUSD: z.number()
		})
	),
	totalRealizedGainsUSD: z.number(),
	totalUnrealizedGainsUSD: z.number()
});

export const yDaemonEarnedSchema = z.object({
	earned: z.record(
		z.string(),
		z.record(
			addressSchema,
			z.object({
				realizedGains: z.string(),
				realizedGainsUSD: z.number(),
				unrealizedGains: z.string(),
				unrealizedGainsUSD: z.number()
			})
		)
	),
	totalRealizedGainsUSD: z.number(),
	totalUnrealizedGainsUSD: z.number()
});

export type TYDaemonEarnedSingle = z.infer<typeof yDaemonSingleEarnedSchema>;
export type TYDaemonEarned = z.infer<typeof yDaemonEarnedSchema>;
