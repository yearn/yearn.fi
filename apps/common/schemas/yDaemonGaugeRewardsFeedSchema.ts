import {z} from 'zod';
import {ADDRESS_REGEX} from '@common/utils/regexes';

export const yDaemonGaugeRewardsFeedSchema = z.array(
	z.object({
		amount: z.string(),
		briber: z.string().regex(ADDRESS_REGEX),
		gauge: z.string().regex(ADDRESS_REGEX),
		rewardToken: z.string().regex(ADDRESS_REGEX),
		txHash: z.string(),
		timestamp: z.number(),
		blockNumber: z.number()
	})
);

export type TYDaemonGaugeRewardsFeed = z.infer<typeof yDaemonGaugeRewardsFeedSchema>;
