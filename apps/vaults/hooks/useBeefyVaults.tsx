import {useMemo} from 'react';
import axios from 'axios';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';

import type {TBalanceData, TUseBalancesReq, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types.d';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

type TBeefyChain = 'metis' | 'celo' | 'cronos' | 'moonbeam' | 'one' | 'moonriver' | 'fuse' | 'arbitrum' | 'heco' | 'avax' | 'aurora' | 'polygon' | 'fantom' | 'bsc' | 'emerald' | 'optimism' | 'kava' | 'ethereum';

export type TBeefyVault = {
    addLiquidityUrl?: string | null;
    assets?: (string)[] | null;
    balance: TBalanceData;
    buyTokenUrl?: string | null;
    callFee?: number | null;
    chain: TBeefyChain;
    createdAt: number;
    depositFee?: string | null;
    earnContractAddress: string;
    earnedToken: string;
    earnedTokenAddress: string;
    id: string;
    lastHarvest: number;
    mintTokenUrl?: string | null;
    name: string;
    network?: string | null;
    oracle: string;
    oracleId: string;
    pauseReason?: string | null;
    platformId: string;
    pricePerFullShare: string;
    refund?: boolean | null;
    refundContractAddress?: string | null;
    removeLiquidityUrl?: string | null;
    retireReason?: string | null;
    risks?: (string)[] | null;
    showWarning?: boolean | null;
    status: string;
    strategy: string;
    strategyTypeId: string;
    token: string;
    tokenAddress?: string | null;
    tokenDecimals: number;
    tokenProviderId?: string | null;
    warning?: string | null;
}

type TBeefyVaultResponse = {
  vaults?: TBeefyVault[];
  isLoading: boolean;
  hasError: boolean;
  error: unknown;
}

const BEEFY_CHAIN_MAP = new Map<number, string>();
BEEFY_CHAIN_MAP.set(1, 'ethereum');
BEEFY_CHAIN_MAP.set(10, 'optimism');
BEEFY_CHAIN_MAP.set(250, 'fantom');
BEEFY_CHAIN_MAP.set(42161, 'arbitrum');

type TProps = {all?: boolean}

export function useBeefyVaults({all}: TProps = {}): TBeefyVaultResponse {
	const	{provider} = useWeb3();
	const {chainID} = useChainID();

	const pricesFetcher = async (url: string): Promise<TDict<string>> => axios.get(url).then((res): TDict<string> => res.data);
	const beefyVaultsFetcher = async (url: string): Promise<TBeefyVault[]> => axios.get(url).then((res): TBeefyVault[] => res.data);

	const {data: prices} = useSWR(`${process.env.YDAEMON_BASE_URI}/1/prices/all`, pricesFetcher);
	const {data: vaults, isValidating, error} = useSWR(
		`https://api.beefy.finance/vaults/${all ? '' : BEEFY_CHAIN_MAP.get(chainID)}`,
		beefyVaultsFetcher
	);

	const	{data: balances} = useBalances({
		key: 0,
		provider,
		tokens: vaults?.reduce((prev, {tokenAddress}): TUseBalancesReq['tokens'] => {
			if (!tokenAddress) {
				return prev; 
			}
			return [...prev, {token: tokenAddress}];
		}, [] as TUseBalancesTokens[]) || [],
		prices,
		effectDependencies: [vaults]
	});

	const beefyVaultsWithBalance = useMemo((): TBeefyVault[] => {
		return (vaults || []).reduce((prev, curr): TBeefyVault[] => {
			if (!curr.tokenAddress) {
				return prev;
			}
			const vaultWithBalance = {...curr, balance: balances[curr.tokenAddress]};
			return [...prev, vaultWithBalance];
		}, [] as TBeefyVault[]);
	}, [balances, vaults]);

	return {
		vaults: beefyVaultsWithBalance,
		isLoading: isValidating || !error && !vaults,
		hasError: !!error,
		error
	};
}
