import {z} from 'zod';

import {useFetch} from './useFetch';

import type {SWRResponse} from 'swr';

const KatanaAprSchema = z.record(
	z.string(),
	z.union([
		z.object({
			apr: z
				.union([
					z.object({
						netAPR: z.number().nullable().optional().default(0),
						extra: z
							.object({
								katanaRewardsAPR: z.number().nullable().optional().default(0)
							})
							.optional()
							.default({katanaRewardsAPR: 0})
					}),
					z.number()
				])
				.optional()
				.default({netAPR: 0, extra: {katanaRewardsAPR: 0}})
		}),
		z.any()
	])
);

export type TKatanaAprs = z.infer<typeof KatanaAprSchema>;

export function useKatanaAprs(): SWRResponse<TKatanaAprs> & {isSuccess: boolean} {
	return useFetch<TKatanaAprs>({
		endpoint: 'https://katana-apr-service.vercel.app/api/vaults',
		schema: KatanaAprSchema,
		config: {
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
			refreshInterval: 60 * 60 * 1000, // 1 hour
			dedupingInterval: 60 * 60 * 1000
		}
	});
}
