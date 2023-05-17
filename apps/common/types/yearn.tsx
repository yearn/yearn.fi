import type {TAddress} from '@yearn-finance/web-lib/types';

export type TYearnVaultToken = {
	address: TAddress,
	underlyingTokensAddresses: TAddress[],
	name: string,
	display_name: string,
	symbol: string,
	description: string,
	decimals: number,
	icon: string,
}

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
