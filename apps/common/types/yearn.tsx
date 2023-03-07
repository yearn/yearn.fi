import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type	TSettingsForNetwork = {
	rpcURI?: string,
	yDaemonURI?: string,
	graphURI?: string,
	metaURI?: string,
	apiURI?: string,
	explorerBaseURI?: string,
	lensOracleAddress?: TAddress,
	partnerContractAddress?: TAddress
}

export type TYDaemonToken = {
	address: TAddress,
	name: string,
	symbol: string,
	price: number,
	decimals: number,
	isVault: boolean,
	display_symbol: string,
	description: string,
	website: string,
	categories: string[],
	underlyingTokensAddresses: TAddress[],
}

export type TYDaemonHarvests = {
	vaultAddress: TAddress,
	strategyAddress: TAddress,
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
	briber: TAddress;
	gauge: TAddress;
	rewardToken: TAddress;
	amount: string;
	txHash: string;
	timestamp: string;
	blockNumber: string;
}
