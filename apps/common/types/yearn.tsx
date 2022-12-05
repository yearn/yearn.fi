import type {TDict} from '@yearn-finance/web-lib/utils';

export type TYearnVaultStrategy = {
	address: string,
	name: string,
	description: string,
	details: {
		keeper: string,
		strategist: string,
		rewards: string,
		healthCheck: string,
		totalDebt: string,
		totalLoss: string,
		totalGain: string,
		minDebtPerHarvest: string,
		maxDebtPerHarvest: string,
		estimatedTotalAssets: string,
		creditAvailable: string,
		debtOutstanding: string,
		expectedReturn: string,
		delegatedAssets: string,
		delegatedValue: string,
		protocols: string[],
		version: string,
		apr: number,
		performanceFee: number,
		lastReport: number,
		activation: number,
		keepCRV: number,
		debtRatio: number,
		debtLimit: number,
		withdrawalQueuePosition: number,
		doHealthCheck: boolean,
		inQueue: boolean,
		emergencyExit: boolean,
		isActive: boolean,
	}
	risk: {
		riskGroup: string,
		TVLImpact: number,
		auditScore: number,
		codeReviewScore: number,
		complexityScore: number,
		longevityImpact: number,
		protocolSafetyScore: number,
		teamKnowledgeScore: number,
		testingScore: number,
	}
}

export type TYearnVault = {
    inception: number,
    address: string,
    symbol: string,
    display_symbol: string,
    formated_symbol: string,
    name: string,
    display_name: string,
    formated_name: string,
    icon: string,
	category: string,
	riskScore: number,
    token: {
        address: string,
        name: string,
        display_name: string,
        symbol: string,
        description: string,
        decimals: number,
        icon: string,
    },
    tvl: {
        total_assets: string,
        tvl: number,
        price: number
    },
    apy: {
        type: string,
        gross_apr: number,
        net_apy: number,
        fees: {
            performance: number,
            withdrawal: number,
            management: number,
            keep_crv: number,
            cvx_keep_crv: number
        },
        points: {
            week_ago: number,
            month_ago: number,
            inception: number,
        },
        composite: {
            boost: number,
            pool_apy: number,
            boosted_apr: number,
            base_apr: number,
            cvx_apr: number,
            rewards_apr: number
        }
    },
    strategies: TYearnVaultStrategy[],
	details: {
		management: string,
		governance: string,
		guardian: string,
		rewards: string,
		depositLimit: string,
		comment: string,
		apyTypeOverride: string,
		apyOverride: number,
		performanceFee: number,
		managementFee: number,
		depositsDisabled: boolean,
		withdrawalsDisabled: boolean,
		allowZapIn: boolean,
		allowZapOut: boolean,
		retired: boolean
	},
    endorsed: boolean,
    version: string,
    decimals: number,
    type: string,
    emergency_shutdown: boolean,
    updated: number,
    migration: {
        available: boolean,
        address: string,
    }
}

export type	TSettingsForNetwork = {
	rpcURI?: string,
	yDaemonURI?: string,
	graphURI?: string,
	metaURI?: string,
	apiURI?: string,
	explorerBaseURI?: string,
	lensAddress?: string,
	partnerContractAddress?: string
}

export type TYDaemonToken = {
	address: string,
	name: string,
	symbol: string,
	price: number,
	decimals: number,
	isVault: boolean,
	display_symbol: string,
	description: string,
	website: string,
	categories: string[],
}

export type TYDaemonHarvests = {
	vaultAddress: string,
	strategyAddress: string,
	txHash: string,
	timestamp: string,
	profit: string,
	profitValue: number,
	loss: string,
	lossValue: number,
}

export type TYDaemonReports = {
	debtAdded: string,
	debtLimit: string,
	totalDebt: string,
	gain: string,
	totalGain: string,
	loss: string,
	totalLoss: string,
	debtPaid: string,
	timestamp: string,
	results: [{
		duration: string,
		durationPR: string,
		APR: string
	}]
}

export type TYdaemonEarned = {
	earned: TDict<{
		realizedGains: string,
		unrealizedGains: string,
		realizedGainsUSD: number,
		unrealizedGainsUSD: number
	}>,
	totalRealizedGainsUSD: number,
	totalUnrealizedGainsUSD: number,
}

export type TYDaemonGaugeRewardsFeed = {
	amount: string;
	briber: string;
	gauge: string;
	rewardToken: string;
	txHash: string;
	timestamp: string;
	blockNumber: string;
}
