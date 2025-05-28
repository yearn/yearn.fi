import {zeroAddress} from 'viem';
import {z} from 'zod';
import {addressSchema} from '@builtbymom/web3/types';
import {toBigInt} from '@builtbymom/web3/utils';

const yDaemonVaultStrategySchema = z.object({
	address: addressSchema,
	name: z.string(),
	description: z.string().optional().default(''),
	status: z.literal('active').or(z.literal('not_active')).or(z.literal('unallocated')),
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
		.or(z.literal('Yearn Vault'))
		.default('Standard')
		.catch('Standard'),
	kind: z
		.literal('Legacy')
		.or(z.literal('Multi Strategy'))
		.or(z.literal('Single Strategy'))
		.default('Legacy')
		.catch('Legacy'),
	symbol: z.string(),
	name: z.string(),
	description: z.string().default('').catch(''),
	category: z
		.literal('Curve')
		.or(z.literal('Stablecoin'))
		.or(z.literal('Aerodrome'))
		.or(z.literal('Volatile'))
		.or(z.literal('Balancer'))
		.or(z.literal('Velodrome'))
		.or(z.literal('Prisma'))
		.or(z.literal('Gamma'))
		.or(z.literal('Pendle'))
		.or(z.literal('Prisma'))
		.or(z.literal('Boosted'))
		.or(z.string().min(1))
		.default('Volatile')
		.catch('Volatile'),
	decimals: z.number(),
	chainID: z.number(),
	token: yDaemonVaultTokenSchema,
	tvl: z.object({
		totalAssets: z
			.string()
			.default('0')
			.catch('0')
			.transform((val): bigint => toBigInt(val)),
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
				management: z.number().default(0).catch(0)
			})
			.default({}),
		extra: z
			.object({
				stakingRewardsAPR: z.number().default(0).catch(0),
				gammaRewardAPR: z.number().default(0).catch(0)
			})
			.default({}),
		points: z
			.object({
				weekAgo: z.number().default(0).catch(0),
				monthAgo: z.number().default(0).catch(0),
				inception: z.number().default(0).catch(0)
			})
			.default({}),
		pricePerShare: z
			.object({
				today: z.number().default(0).catch(0),
				weekAgo: z.number().default(0).catch(0),
				monthAgo: z.number().default(0).catch(0)
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
						rewardsAPR: z.number().default(0).catch(0),
						v3OracleCurrentAPR: z.number().default(0).catch(0),
						v3OracleStratRatioAPR: z.number().default(0).catch(0),
						keepCRV: z.number().default(0).catch(0),
						keepVELO: z.number().default(0).catch(0),
						cvxKeepCRV: z.number().default(0).catch(0)
					})
					.default({})
			})
			.default({})
	}),
	featuringScore: z.number().default(0).catch(0),
	strategies: z.array(yDaemonVaultStrategySchema).nullable().default([]),
	staking: z
		.object({
			address: addressSchema.default(zeroAddress).catch(zeroAddress),
			available: z.boolean().default(false).catch(false),
			source: z.string().default('').catch(''),
			rewards: z
				.array(
					z.object({
						address: addressSchema,
						name: z.string(),
						symbol: z.string(),
						decimals: z.number(),
						price: z.number(),
						isFinished: z.boolean(),
						finishedAt: z.number(),
						apr: z.number().nullable(),
						perWeek: z.number()
					})
				)
				.nullable()
				.default([])
		})
		.default({
			address: zeroAddress,
			available: false,
			source: '',
			rewards: []
		})
		.catch({
			address: zeroAddress,
			available: false,
			source: '',
			rewards: []
		}),
	migration: z.object({
		available: z.boolean(),
		address: addressSchema.default(zeroAddress).catch(zeroAddress),
		contract: addressSchema.default(zeroAddress).catch(zeroAddress)
	}),
	info: z.object({
		sourceURL: z.string().optional().default('').catch(''),
		riskLevel: z.number().optional().default(-1).catch(-1),
		riskScore: z.array(z.number()).optional().default([]).catch([]),
		riskScoreComment: z.string().optional().default('').catch(''),
		uiNotice: z.string().optional().default('').catch(''),
		isRetired: z.boolean().default(false).catch(false),
		isBoosted: z.boolean().default(false).catch(false),
		isHighlighted: z.boolean().default(false).catch(false)
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
