import {useCallback} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {isAutomatedVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import {useYearn} from '@common/contexts/useYearn';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress, TDict} from '@builtbymom/web3/types';

export function useFilteredVaults(
	vaultMap: TDict<TYDaemonVault>,
	condition: (v: TYDaemonVault) => boolean
): TYDaemonVault[] {
	return useDeepCompareMemo(
		(): TYDaemonVault[] => Object.values(vaultMap).filter((vault): boolean => condition(vault)),
		[vaultMap, condition]
	);
}

export function useVaultFilter(
	categories: string[] | null,
	chains: number[] | null,
	v3?: boolean
): {
	activeVaults: TYDaemonVault[];
	retiredVaults: TYDaemonVault[];
	migratableVaults: TYDaemonVault[];
} {
	const {vaults, vaultsMigrations, vaultsRetired} = useYearn();
	const {getToken} = useYearn();
	const {shouldHideDust} = useAppSettings();

	const filterHoldingsCallback = useCallback(
		(vault: TYDaemonVault, isFactoryOnly: boolean): boolean => {
			const vaultHoldings = getToken({address: vault.address, chainID: vault.chainID});

			// [Optimism] Check if staked vaults have holdings
			if (chains?.includes(10) && vault.staking.available) {
				const stakingdHolding = getToken({address: vault.staking.address, chainID: vault.chainID});
				const hasValidStakedBalance = stakingdHolding.balance.raw > 0n;
				const stakedBalanceValue =
					Number(stakingdHolding.balance.normalized) * Number(vaultHoldings.price.normalized);
				if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
					return true;
				}
			}

			const hasValidBalance = vaultHoldings.balance.raw > 0n;
			const balanceValue = vaultHoldings.value || 0;
			if (shouldHideDust && balanceValue < 0.01) {
				return false;
			}
			if (hasValidBalance) {
				if (isFactoryOnly) {
					if (vault.category === 'Curve' && isAutomatedVault(vault)) {
						return true;
					}
					return false;
				}
				return true;
			}
			return false;
		},
		[getToken, chains, shouldHideDust]
	);

	const filterMigrationCallback = useCallback(
		(address: TAddress, chainID: number): boolean => {
			const holding = getToken({address, chainID});
			const hasValidPrice = holding.price.raw > 0n;
			const hasValidBalance = holding.balance.raw > 0n;
			if (hasValidBalance && (hasValidPrice ? (holding?.value || 0) >= 0.01 : true)) {
				return true;
			}
			return false;
		},
		[getToken]
	);

	// V3 Filtered Vaults
	const singleVault = useFilteredVaults(
		vaults,
		({version, kind}): boolean => (version || '')?.split('.')?.[0] === '3' && kind === 'Single Strategy'
	);
	const MultiVault = useFilteredVaults(
		vaults,
		({version, kind}): boolean => (version || '')?.split('.')?.[0] === '3' && kind === 'Multi Strategy'
	);

	//V2 Filtered Vaults
	const boostedVaults = useFilteredVaults(vaults, ({apr}): boolean => apr.extra.stakingRewardsAPR > 0);
	const curveVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Curve');
	const prismaVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Prisma');
	const velodromeVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Velodrome');
	const aerodromeVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Aerodrome');
	const stablesVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Stablecoin');
	const balancerVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Balancer');
	const cryptoVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Volatile');
	const holdingsVaults = useFilteredVaults(vaults, (vault): boolean => filterHoldingsCallback(vault, false));
	const curveFactoryVaults = useFilteredVaults(
		vaults,
		(vault): boolean => vault.category === 'Curve' && isAutomatedVault(vault)
	);
	const migratableVaults = useFilteredVaults(vaultsMigrations, ({address, chainID}): boolean =>
		filterMigrationCallback(address, chainID)
	);
	const retiredVaults = useFilteredVaults(vaultsRetired, ({address, chainID}): boolean =>
		filterMigrationCallback(address, chainID)
	);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	First, we need to determine in which category we are. The activeVaults function will
	 **	decide which vaults to display based on the category. No extra filters are applied.
	 **	The possible lists are memoized to avoid unnecessary re-renders.
	 **********************************************************************************************/
	const activeVaults = useDeepCompareMemo((): TYDaemonVault[] => {
		let _vaultList: TYDaemonVault[] = [];
		if (v3) {
			if (categories?.includes('single')) {
				_vaultList = [..._vaultList, ...singleVault];
			}
			if (categories?.includes('multi')) {
				_vaultList = [..._vaultList, ...MultiVault];
			}
			return _vaultList;
		}

		if (categories?.includes('featured')) {
			_vaultList.sort(
				(a, b): number => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0)
			);
			_vaultList = _vaultList.slice(0, 10);
		}
		if (categories?.includes('curveF')) {
			_vaultList = [..._vaultList, ...curveFactoryVaults];
		}
		if (categories?.includes('curve')) {
			_vaultList = [..._vaultList, ...curveVaults];
		}
		if (categories?.includes('prisma')) {
			_vaultList = [..._vaultList, ...prismaVaults];
		}
		if (categories?.includes('balancer')) {
			_vaultList = [..._vaultList, ...balancerVaults];
		}
		if (categories?.includes('velodrome')) {
			_vaultList = [..._vaultList, ...velodromeVaults];
		}
		if (categories?.includes('aerodrome')) {
			_vaultList = [..._vaultList, ...aerodromeVaults];
		}
		if (categories?.includes('boosted')) {
			_vaultList = [..._vaultList, ...boostedVaults];
		}
		if (categories?.includes('stables')) {
			_vaultList = [..._vaultList, ...stablesVaults];
		}
		if (categories?.includes('crypto')) {
			_vaultList = [..._vaultList, ...cryptoVaults];
		}
		if (categories?.includes('holdings')) {
			_vaultList = [..._vaultList, ...holdingsVaults];
		}

		//remove duplicates
		_vaultList = _vaultList.filter(
			(vault, index, self): boolean => index === self.findIndex((v): boolean => v.address === vault.address)
		);

		// Remove v3 vaults
		_vaultList = _vaultList.filter((vault): boolean => !vault.version?.startsWith('3'));
		return _vaultList;
	}, [
		v3,
		categories,
		singleVault,
		MultiVault,
		curveFactoryVaults,
		curveVaults,
		prismaVaults,
		balancerVaults,
		velodromeVaults,
		aerodromeVaults,
		boostedVaults,
		stablesVaults,
		cryptoVaults,
		holdingsVaults
	]);

	return {activeVaults, migratableVaults, retiredVaults};
}
