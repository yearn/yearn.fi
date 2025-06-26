import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {deserialize, serialize} from 'wagmi';
import {useLocalStorageValue} from '@react-hookz/web';
import {Solver, type TSolver} from '@vaults-v2/types/solvers';
import {useFetchYearnEarnedForUser} from '@lib/hooks/useFetchYearnEarnedForUser';
import {useFetchYearnPrices} from '@lib/hooks/useFetchYearnPrices';
import {useFetchYearnVaults} from '@lib/hooks/useFetchYearnVaults';
import {toAddress, toNormalizedBN, zeroNormalizedBN} from '@lib/utils';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TAddress, TDict, TNormalizedBN} from '@lib/types';
import type {TYDaemonEarned} from '@lib/utils/schemas/yDaemonEarnedSchema';
import type {TYDaemonPricesChain} from '@lib/utils/schemas/yDaemonPricesSchema';
import type {TYDaemonVault, TYDaemonVaults} from '@lib/utils/schemas/yDaemonVaultsSchemas';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;

type TTokenAndChain = {address: TAddress; chainID: number};
export type TYearnContext = {
	currentPartner: TAddress;
	earned?: TYDaemonEarned;
	prices?: TYDaemonPricesChain;
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	zapSlippage: number;
	maxLoss: bigint;
	zapProvider: TSolver;
	isAutoStakingEnabled: boolean;
	mutateVaultList: KeyedMutator<TYDaemonVaults>;
	set_maxLoss: (value: bigint) => void;
	set_zapSlippage: (value: number) => void;
	set_zapProvider: (value: TSolver) => void;
	set_isAutoStakingEnabled: (value: boolean) => void;
	//
	//Price context
	getPrice: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
};

const YearnContext = createContext<TYearnContext>({
	currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
	earned: {
		earned: {},
		totalRealizedGainsUSD: 0,
		totalUnrealizedGainsUSD: 0
	},
	prices: {},
	vaults: {},
	vaultsMigrations: {},
	vaultsRetired: {},
	isLoadingVaultList: false,
	maxLoss: DEFAULT_MAX_LOSS,
	zapSlippage: 0.1,
	zapProvider: Solver.enum.Cowswap,
	isAutoStakingEnabled: true,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mutateVaultList: (): any => undefined,
	set_maxLoss: (): void => undefined,
	set_zapSlippage: (): void => undefined,
	set_zapProvider: (): void => undefined,
	set_isAutoStakingEnabled: (): void => undefined,

	//Price context
	getPrice: (): TNormalizedBN => zeroNormalizedBN
});

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {value: maxLoss, set: set_maxLoss} = useLocalStorageValue<bigint>('yearn.fi/max-loss', {
		defaultValue: DEFAULT_MAX_LOSS,
		parse: (str, fallback): bigint => (str ? deserialize(str) : (fallback ?? DEFAULT_MAX_LOSS)),
		stringify: (data: bigint): string => serialize(data)
	});
	const {value: zapSlippage, set: set_zapSlippage} = useLocalStorageValue<number>('yearn.fi/zap-slippage', {
		defaultValue: DEFAULT_SLIPPAGE
	});
	const {value: zapProvider, set: set_zapProvider} = useLocalStorageValue<TSolver>('yearn.fi/zap-provider', {
		defaultValue: Solver.enum.Cowswap
	});
	const {value: isAutoStakingEnabled, set: set_isAutoStakingEnabled} = useLocalStorageValue<boolean>(
		'yearn.fi/staking-op-boosted-vaults',
		{
			defaultValue: true
		}
	);

	const prices = useFetchYearnPrices();
	const earned = useFetchYearnEarnedForUser();
	const {vaults: rawVaults, vaultsMigrations, vaultsRetired, isLoading, mutate} = useFetchYearnVaults();

	const vaults = useMemo(() => {
		const vaults: TDict<TYDaemonVault> = {};
		for (const vault of Object.values(rawVaults)) {
			vaults[toAddress(vault.address)] = {...vault};
		}
		return vaults;
	}, [rawVaults]);

	const getPrice = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN;
		},
		[prices]
	);

	return (
		<YearnContext.Provider
			value={{
				currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
				prices,
				earned,
				zapSlippage: zapSlippage ?? DEFAULT_SLIPPAGE,
				maxLoss: maxLoss ?? DEFAULT_MAX_LOSS,
				zapProvider: zapProvider ?? Solver.enum.Cowswap,
				isAutoStakingEnabled: isAutoStakingEnabled ?? true,
				set_zapSlippage,
				set_maxLoss,
				set_zapProvider,
				set_isAutoStakingEnabled,
				vaults,
				vaultsMigrations,
				vaultsRetired,
				isLoadingVaultList: isLoading,
				mutateVaultList: mutate,
				getPrice
			}}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
