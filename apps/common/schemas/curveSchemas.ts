import {z} from 'zod';
import {toAddress} from '@yearn-finance/web-lib/utils/address';


export const curveWeeklyFeesSchema = z.object({
	success: z.boolean().optional(),
	data: z.object({
		weeklyFeesTable: z
			.object({
				date: z.string(),
				ts: z.number(),
				rawFees: z.number()
			})
			.array()
			.optional()
			.nullable(),
		totalFees: z.object({
			fees: z.number()
		})
	}),
	generatedTimeMs: z.number().optional()
});

const curveGaugeSchema = z.object({
	poolUrls: z.object({
		swap: z.string().array().optional().nullable(),
		deposit: z.string().array().optional().nullable(),
		withdraw: z.string().array().optional().nullable()
	}).optional(),
	swap: z.string().optional().transform(toAddress),
	swap_token: z.string().optional().transform(toAddress),
	name: z.string(),
	shortName: z.string().optional(),
	gauge: z.string().optional().transform(toAddress),
	swap_data: z
		.object({virtual_price: z.string().or(z.number().optional())})
		.optional(),
	gauge_data: z.object({
		inflation_rate: z.string().optional(),
		working_supply: z.string().optional()
	}).optional(),
	gauge_controller: z.object({
		gauge_relative_weight: z.string().optional(),
		get_gauge_weight: z.string().optional(),
		inflation_rate: z.string().optional()
	}).optional(),
	factory: z.boolean(),
	side_chain: z.boolean().optional(),
	is_killed: z.boolean().optional(),
	hasNoCrv: z.boolean().optional(),
	type: z.string().optional(),
	lpTokenPrice: z.number().nullable().optional(),
	rewardPerGauge: z.string().array().optional()
});

export const curveAllGaugesSchema = z.object({
	success: z.boolean().optional(),
	data: z.record(
		z.string(),
		curveGaugeSchema
	),
	generatedTimeMs: z.number().optional()
});

export const curveGaugeFromYearnSchema = z.object({
	gauge_name: z.string(),
	gauge_address: z.string().transform(toAddress),
	pool_address: z.string().transform(toAddress),
	pool_coins: z.object({
		name: z.string().optional(),
		address: z.string().transform(toAddress),
		error: z.string().optional()
	}).array().optional(),
	lp_token: z.string().transform(toAddress),
	weight: z.string(),
	inflation_rate: z.string(),
	working_supply: z.string(),
	apy: z.object({
		type: z.string(),
		gross_apr: z.number(),
		net_apy: z.number(),
		fees: z.object({
			performance: z.number(),
			withdrawal: z.number().nullable(),
			management: z.number().nullable(),
			keep_crv: z.number().nullable(),
			cvx_keep_crv: z.number().nullable()
		}).optional(),
		points: z.object({
			week_ago: z.number(),
			month_ago: z.number(),
			inception: z.number()
		}).nullable().optional(),
		blocks: z.any().nullable().optional(),
		composite: z.object({
			boost: z.number(),
			pool_apy: z.number(),
			boosted_apr: z.number(),
			base_apr: z.number(),
			cvx_apr: z.number(),
			rewards_apr: z.number()
		}).nullable().optional(),
		error_reason: z.string().nullable().optional(),
		staking_rewards_apr: z.number().optional()
	}),
	updated: z.number(),
	block: z.number()
});

export const curveGaugesFromYearnSchema = curveGaugeFromYearnSchema.array();

export type TCurveWeeklyFees = z.infer<typeof curveWeeklyFeesSchema>;
export type TCurveGauge = z.infer<typeof curveGaugeSchema>;
export type TCurveAllGauges = z.infer<typeof curveAllGaugesSchema>;
export type TCurveGaugeFromYearn = z.infer<typeof curveGaugeFromYearnSchema>;
export type TCurveGaugesFromYearn = z.infer<typeof curveGaugesFromYearnSchema>;
