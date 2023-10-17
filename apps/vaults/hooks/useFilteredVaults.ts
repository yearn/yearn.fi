import {useCallback, useMemo} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {OPT_VAULTS_WITH_REWARDS, STACKING_TO_VAULT} from '@vaults/constants/optRewards';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export function useFilteredVaults(
	vaultMap: TDict<TYDaemonVault>,
	condition: (v: TYDaemonVault) => boolean
): TYDaemonVault[] {
	return useMemo(
		(): TYDaemonVault[] => Object.values(vaultMap).filter((vault): boolean => condition(vault)),
		[vaultMap, condition]
	);
}

export function useVaultFilter(): {
	activeVaults: TYDaemonVault[];
	retiredVaults: TYDaemonVault[];
	migratableVaults: TYDaemonVault[];
} {
	const {vaults, vaultsMigrations, vaultsRetired} = useYearn();
	const {getToken} = useWallet();
	const {shouldHideDust, category, selectedChains} = useAppSettings();
	const chainsFromJSON = useMemo((): number[] => JSON.parse(selectedChains || '[]') as number[], [selectedChains]);
	const categoriesFromJSON = useMemo((): string[] => JSON.parse(category || '[]') as string[], [category]);

	const filterHoldingsCallback = useCallback(
		(address: TAddress, chainID: number): boolean => {
			const holding = getToken({address, chainID});

			// [Optimism] Check if staked vaults have holdings
			if (chainsFromJSON.includes(10)) {
				const stakedVaultAddress = STACKING_TO_VAULT[toAddress(address)];
				const stakedHolding = getToken({address: stakedVaultAddress, chainID});
				const hasValidStakedBalance = stakedHolding.balance.raw > 0n;
				const stakedBalanceValue = stakedHolding.value || 0;
				if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
					return true;
				}
			}

			const hasValidBalance = holding.balance.raw > 0n;
			const balanceValue = holding.value || 0;
			if (shouldHideDust && balanceValue < 0.01) {
				return false;
			}
			if (hasValidBalance) {
				return true;
			}
			return false;
		},
		[getToken, chainsFromJSON, shouldHideDust]
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

	const boostedVaults = useFilteredVaults(vaults, ({address}): boolean => {
		if (chainsFromJSON.includes(10)) {
			return false;
		}
		return OPT_VAULTS_WITH_REWARDS.some((token): boolean => token === address);
	});
	const curveVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Curve');
	const velodromeVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Velodrome');
	const aerodromeVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Aerodrome');
	const stablesVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Stablecoin');
	const balancerVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Balancer');
	const cryptoVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Volatile');
	const holdingsVaults = useFilteredVaults(vaults, ({address, chainID}): boolean =>
		filterHoldingsCallback(address, chainID)
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

		if (categoriesFromJSON.includes('Featured Vaults')) {
			_vaultList.sort(
				(a, b): number => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0)
			);
			_vaultList = _vaultList.slice(0, 10);
		}
		if (categoriesFromJSON.includes('Curve Vaults')) {
			_vaultList = [..._vaultList, ...curveVaults];
		}
		if (categoriesFromJSON.includes('Balancer Vaults')) {
			_vaultList = [..._vaultList, ...balancerVaults];
		}
		if (categoriesFromJSON.includes('Velodrome Vaults')) {
			_vaultList = [..._vaultList, ...velodromeVaults];
		}
		if (categoriesFromJSON.includes('Aerodrome Vaults')) {
			_vaultList = [..._vaultList, ...aerodromeVaults];
		}
		if (categoriesFromJSON.includes('Boosted Vaults')) {
			_vaultList = [..._vaultList, ...boostedVaults];
		}
		if (categoriesFromJSON.includes('Stables Vaults')) {
			_vaultList = [..._vaultList, ...stablesVaults];
		}
		if (categoriesFromJSON.includes('Crypto Vaults')) {
			_vaultList = [..._vaultList, ...cryptoVaults];
		}
		if (categoriesFromJSON.includes('Holdings')) {
			_vaultList = [..._vaultList, ...holdingsVaults];
		}

		//remove duplicates
		_vaultList = _vaultList.filter(
			(vault, index, self): boolean => index === self.findIndex((v): boolean => v.address === vault.address)
		);

		return _vaultList;
	}, [
		categoriesFromJSON,
		curveVaults,
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
