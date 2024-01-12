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
	poolUrls: z
		.object({
			swap: z.string().array().optional().nullable(),
			deposit: z.string().array().optional().nullable(),
			withdraw: z.string().array().optional().nullable()
		})
		.optional(),
	swap: z.string().optional().transform(toAddress),
	swap_token: z.string().optional().transform(toAddress),
	name: z.string(),
	shortName: z.string().optional(),
	gauge: z.string().optional().transform(toAddress),
	swap_data: z.object({virtual_price: z.string().or(z.number().optional())}).optional(),
	gauge_data: z
		.object({
			inflation_rate: z.number().or(z.string()).optional().default('0'),
			working_supply: z.string().optional()
		})
		.optional(),
	gauge_controller: z
		.object({
			gauge_relative_weight: z.string().optional(),
			get_gauge_weight: z.string().optional(),
			inflation_rate: z.number().or(z.string()).optional().default('0')
		})
		.optional(),
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
	data: z.record(z.string(), curveGaugeSchema),
	generatedTimeMs: z.number().optional()
});

export const curveGaugeFromYearnSchema = z.object({
	gauge_name: z.string(),
	gauge_address: z.string().optional().transform(toAddress),
	pool_address: z.string().optional().transform(toAddress),
	pool_coins: z
		.object({
			name: z.string().optional(),
			address: z.string().transform(toAddress),
			error: z.string().optional()
		})
		.array()
		.optional(),
	lp_token: z.string().optional().transform(toAddress),
	weight: z.string().optional().default('0'),
	inflation_rate: z.string().or(z.number()).optional().default('0'),
	working_supply: z.string().default('0'),
	apy: z.object({
		type: z.string(),
		gross_apr: z.number().default(0),
		net_apy: z.number().default(0)
	})
});

export const curveGaugesFromYearnSchema = curveGaugeFromYearnSchema.array();

export type TCurveWeeklyFees = z.infer<typeof curveWeeklyFeesSchema>;
export type TCurveGauge = z.infer<typeof curveGaugeSchema>;
export type TCurveAllGauges = z.infer<typeof curveAllGaugesSchema>;
export type TCurveGaugeFromYearn = z.infer<typeof curveGaugeFromYearnSchema>;
export type TCurveGaugesFromYearn = z.infer<typeof curveGaugesFromYearnSchema>;
