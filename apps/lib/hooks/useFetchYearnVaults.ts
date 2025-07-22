import {zeroAddress} from 'viem';
import {type Address} from 'viem';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useFetch} from '@lib/hooks/useFetch';
import {useYDaemonBaseURI} from '@lib/hooks/useYDaemonBaseURI';
import {toAddress} from '@lib/utils';
import {yDaemonVaultsSchema} from '@lib/utils/schemas/yDaemonVaultsSchemas';

import type {KeyedMutator} from 'swr';
import type {TDict} from '@lib/types';
import type {TYDaemonVault, TYDaemonVaults} from '@lib/utils/schemas/yDaemonVaultsSchemas';

/******************************************************************************
 ** The useFetchYearnVaults hook is used to fetch the vaults from the yDaemon
 ** API.
 ** It will fetch 3 kinds of vaults:
 ** - The active vaults
 ** - The vaults that are in the migration process
 ** - The retired vaults
 *****************************************************************************/
function useFetchYearnVaults(chainIDs?: number[] | undefined): {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoading: boolean;
	mutate: KeyedMutator<TYDaemonVaults>;
} {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();

	const {
		data: vaults,
		isLoading,
		mutate
	} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			hideAlways: 'true',
			orderBy: 'featuringScore',
			orderDirection: 'desc',
			strategiesDetails: 'withDetails',
			strategiesCondition: 'inQueue',

			chainIDs: chainIDs ? chainIDs.join(',') : [1, 10, 137, 146, 250, 8453, 42161, 747474].join(','),
			limit: '2500'
		})}`,
		schema: yDaemonVaultsSchema
	});

	// const vaultsMigrations: TYDaemonVaults = useMemo(() => [], []);
	const {data: vaultsMigrations} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			chainIDs: chainIDs ? chainIDs.join(',') : [1, 10, 137, 146, 250, 8453, 42161, 747474].join(','),
			migratable: 'nodust',
			limit: '2500'
		})}`,
		schema: yDaemonVaultsSchema
	});

	// const vaultsRetired: TYDaemonVaults = useMemo(() => [], []);
	const {data: vaultsRetired} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/retired?${new URLSearchParams({
			limit: '2500'
		})}`,
		schema: yDaemonVaultsSchema
	});

	const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaults) {
			return {};
		}
		const _vaultsObject = (vaults || []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

	// TODO: remove this workaround when possible
	// <WORKAROUND>
	const YBOLD_VAULT_ADDRESS: Address = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8';
	const YBOLD_STAKING_ADDRESS: Address = '0x23346B04a7f55b8760E5860AA5A77383D63491cD';

	const yBoldVault = vaultsObject[YBOLD_VAULT_ADDRESS];
	const stYBoldVault = vaultsObject[YBOLD_STAKING_ADDRESS];

	if (yBoldVault && stYBoldVault) {
		// patch staking
		yBoldVault.staking = {
			address: YBOLD_STAKING_ADDRESS,
			available: true,
			source: 'yBOLD',
			rewards: [
				{
					address: zeroAddress,
					name: 'null',
					symbol: 'null',
					decimals: 18,
					price: 0,
					isFinished: false,
					finishedAt: 9748476800,
					apr: null,
					perWeek: 0
				}
			]
		};

		// replace yBOLD apr data with stYBoldVault apr data
		if (yBoldVault?.apr && stYBoldVault?.apr) {
			yBoldVault.apr.netAPR = stYBoldVault.apr.netAPR || yBoldVault.apr.netAPR || 0;
			yBoldVault.apr.points = stYBoldVault.apr.points || yBoldVault.apr.points || {};
			yBoldVault.apr.pricePerShare = stYBoldVault.apr.pricePerShare || yBoldVault.apr.pricePerShare || {};
			// yBoldVault.apr.forwardAPR = stYBoldVault.apr.forwardAPR || yBoldVault.apr.forwardAPR || {};
			yBoldVault.apr.fees.performance = stYBoldVault.apr.fees.performance || yBoldVault.apr.fees.performance || 0;
		}
		console.log('yBold Vault APR data: ', yBoldVault.apr);
	} else {
		console.warn('yBOLD vault workaround: yBOLD or st-yBOLD vault not found');
	}
	// </WORKAROUND>

	const vaultsMigrationsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsMigrations) {
			return {};
		}
		const _migratableVaultsObject = (vaultsMigrations || []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
					acc[toAddress(vault.address)] = vault;
				}
				return acc;
			},
			{}
		);
		return _migratableVaultsObject;
	}, [vaultsMigrations]);

	const vaultsRetiredObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsRetired) {
			return {};
		}
		const _retiredVaultsObject = (vaultsRetired || []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				acc[toAddress(vault.address)] = vault;
				return acc;
			},
			{}
		);
		return _retiredVaultsObject;
	}, [vaultsRetired]);

	return {
		vaults: vaultsObject,
		vaultsMigrations: vaultsMigrationsObject,
		vaultsRetired: vaultsRetiredObject,
		isLoading,
		mutate
	};
}

export {useFetchYearnVaults};
