import {useMemo} from 'react';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {useYearn} from '@common/contexts/useYearn';

import type {SWRResponse} from 'swr';
import type {TBalanceData, TUseBalancesReq, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types.d';

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
	apy?: number;
}

type TBeefyVaultResponse = {
  vaults: TBeefyVault[];
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
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {prices} = useYearn();

	const {data: vaults, isValidating, error} = useSWR(
		`https://api.beefy.finance/vaults/${all ? '' : BEEFY_CHAIN_MAP.get(safeChainID)}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const {data: APY} = useSWR(
		'https://api.beefy.finance/apy',
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	beefyVaults = useMemo((): TBeefyVault[] => vaults || [], [vaults]);

	const	{data: balances, nonce} = useBalances({
		key: 0,
		provider,
		tokens: beefyVaults?.reduce((prev, {tokenAddress}): TUseBalancesReq['tokens'] => {
			if (!tokenAddress) {
				return prev; 
			}
			return [...prev, {token: tokenAddress}];
		}, [] as TUseBalancesTokens[]) || [],
		prices
	});

	const beefyVaultsWithBalance = useMemo((): TBeefyVault[] => {
		nonce; // remove warning, force deep refresh
		return beefyVaults.reduce((prev, curr): TBeefyVault[] => {
			if (!curr.tokenAddress) {
				return prev;
			}
			const vaultWithBalance = {...curr, balance: balances[curr.tokenAddress]};
			return [...prev, vaultWithBalance];
		}, [] as TBeefyVault[]);
	}, [balances, nonce, beefyVaults]);


	const	beefyVaultsWithBalanceAndAPY = useMemo((): TBeefyVault[] => {
		if (!APY) {
			return beefyVaultsWithBalance;
		}

		return beefyVaultsWithBalance.reduce((prev, curr): TBeefyVault[] => {
			const vaultWithAPY = {...curr, apy: APY?.[curr.id] || 0};
			return [...prev, vaultWithAPY];
		}, [] as TBeefyVault[]);
	}, [APY, beefyVaultsWithBalance]);

	return {
		vaults: beefyVaultsWithBalanceAndAPY,
		isLoading: isValidating || !error && !vaults,
		hasError: !!error,
		error
	};
}
