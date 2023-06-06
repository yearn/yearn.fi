import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function useFilteredVaults(
	vaultMap: TDict<TYDaemonVault>,
	condition: (v: TYDaemonVault) => boolean
): TYDaemonVault[] {
	return useMemo((): TYDaemonVault[] => (
		Object.values(vaultMap).filter((vault): boolean => condition(vault))
	), [vaultMap, condition]);
}

export {useFilteredVaults};
