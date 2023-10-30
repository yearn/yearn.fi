import {z} from 'zod';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {addressSchema} from '@yearn-finance/web-lib/utils/schemas/addressSchema';

const yDaemonVaultStrategySchema = z.object({
	address: addressSchema,
	name: z.string(),
	displayName: z.string(),
	description: z.string(),
	details: z
		.object({
			totalDebt: z.string(),
			totalLoss: z.string(),
			totalGain: z.string(),
			performanceFee: z.number(),
			lastReport: z.number(),
			debtRatio: z.number().optional()
		})
		.optional(), // Optional for migratable
	risk: z
		.object({
			riskScore: z.number(),
			riskGroup: z.string(),
			riskDetails: z.object({
				TVLImpact: z.number(),
				auditScore: z.number(),
				codeReviewScore: z.number(),
				complexityScore: z.number(),
				longevityImpact: z.number(),
				protocolSafetyScore: z.number(),
				teamKnowledgeScore: z.number(),
				testingScore: z.number()
			}),
			allocation: z.object({
				status: z.string(),
				currentTVL: z.number().or(z.null()),
				availableTVL: z.number(),
				currentAmount: z.number().or(z.null()),
				availableAmount: z.number().or(z.null())
			})
		})
		.optional() // Optional for migratable
});

export const yDaemonVaultTokenSchema = z.object({
	address: addressSchema,
	name: z.string(),
	symbol: z.string(),
	description: z.string(),
	decimals: z.number()
});

export const yDaemonVaultSchema = z.object({
	address: addressSchema,
	version: z.string(),
	type: z
		.literal('Automated')
		.or(z.literal('Automated Yearn Vault'))
		.or(z.literal('Experimental'))
		.or(z.literal('Experimental Yearn Vault'))
		.or(z.literal('Standard'))
		.or(z.literal('Yearn Vault')),
	kind: z.literal('Legacy').or(z.literal('Multi Strategies')).or(z.literal('Single Strategy')),
	symbol: z.string(),
	name: z.string(),
	category: z
		.literal('Curve')
		.or(z.literal('Volatile').or(z.literal('Balancer')).or(z.literal('Stablecoin')))
		.or(z.literal('Velodrome'))
		.or(z.literal('Boosted'))
		.or(z.literal('Aerodrome')),
	decimals: z.number(),
	chainID: z.number(),
	token: yDaemonVaultTokenSchema,
	tvl: z.object({
		totalAssets: z.string().transform((val): bigint => toBigInt(val)),
		tvl: z.number().default(0).catch(0),
		price: z.number().default(0).catch(0)
	}),
	apr: z.object({
		type: z.string().min(1).default('unknown').catch('unknown'),
		netAPR: z.number().default(0).catch(0),
		fees: z
			.object({
				performance: z.number().default(0).catch(0),
				withdrawal: z.number().default(0).catch(0),
				management: z.number().default(0).catch(0),
				keepCRV: z.number().default(0).catch(0),
				keepVelo: z.number().default(0).catch(0),
				cvxKeepCRV: z.number().default(0).catch(0)
			})
			.default({}),
		extra: z
			.object({
				stakingRewardsAPR: z.number().default(0).catch(0)
			})
			.default({}),
		points: z
			.object({
				weekAgo: z.number().default(0).catch(0),
				monthAgo: z.number().default(0).catch(0),
				inception: z.number().default(0).catch(0)
			})
			.default({}),
		forwardAPR: z
			.object({
				type: z.string().default('unknown').catch('unknown'),
				netAPR: z.number().default(0).catch(0),
				composite: z
					.object({
						boost: z.number().default(0).catch(0),
						poolAPY: z.number().default(0).catch(0),
						boostedAPR: z.number().default(0).catch(0),
						baseAPR: z.number().default(0).catch(0),
						cvxAPR: z.number().default(0).catch(0),
						rewardsAPR: z.number().default(0).catch(0)
					})
					.default({})
			})
			.default({})
	}),
	featuringScore: z.number().default(0).catch(0),
	retired: z.boolean().default(false).catch(false),
	strategies: z.array(yDaemonVaultStrategySchema).nullable().default([]),
	migration: z.object({
		available: z.boolean(),
		address: addressSchema,
		contract: addressSchema
	})
});

export const yDaemonVaultsSchema = z.array(yDaemonVaultSchema);
export const yDaemonVaultHarvestSchema = z.object({
	vaultAddress: addressSchema.optional(),
	strategyAddress: addressSchema.optional(),
	txHash: z.string().optional(),
	timestamp: z.string(),
	profit: z.string(),
	profitValue: z.number().optional(),
	loss: z.string(),
	lossValue: z.number().optional()
});
export const yDaemonVaultHarvestsSchema = z.array(yDaemonVaultHarvestSchema);

export type TYDaemonVault = z.infer<typeof yDaemonVaultSchema>;
export type TYDaemonVaultStrategy = z.infer<typeof yDaemonVaultStrategySchema>;
export type TYDaemonVaults = z.infer<typeof yDaemonVaultsSchema>;
export type TYDaemonVaultHarvest = z.infer<typeof yDaemonVaultHarvestSchema>;
export type TYDaemonVaultHarvests = z.infer<typeof yDaemonVaultHarvestsSchema>;
export type TYDaemonVaultTokenSchema = z.infer<typeof yDaemonVaultTokenSchema>;

export const isStandardVault = (vault: TYDaemonVault): boolean =>
	vault.type === 'Standard' || vault.type === 'Yearn Vault';
export const isAutomatedVault = (vault: TYDaemonVault): boolean =>
	vault.type === 'Automated' || vault.type === 'Automated Yearn Vault';
export const isExperimentalVault = (vault: TYDaemonVault): boolean =>
	vault.type === 'Experimental' || vault.type === 'Experimental Yearn Vault';
