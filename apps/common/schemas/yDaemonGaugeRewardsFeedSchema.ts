import {z} from 'zod';
import {addressSchema} from '@common/schemas/custom/addressSchema';

export const yDaemonGaugeRewardSchema = z.object({
	amount: z.string(),
	briber: addressSchema,
	gauge: addressSchema,
	rewardToken: addressSchema,
	txHash: z.string(),
	timestamp: z.number(),
	blockNumber: z.number()
});

export const yDaemonGaugeRewardsFeedSchema = z.array(yDaemonGaugeRewardSchema);

export type TYDaemonGaugeReward = z.infer<typeof yDaemonGaugeRewardSchema>;

export type TYDaemonGaugeRewardsFeed = z.infer<typeof yDaemonGaugeRewardsFeedSchema>;
