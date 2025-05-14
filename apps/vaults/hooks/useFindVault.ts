import {useMemo} from 'react';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TDict} from 'builtbymom-web3-fork/types';

export function useFindVault(
	vaultMap: TDict<TYDaemonVault>,
	condition: (v: TYDaemonVault) => boolean
): TYDaemonVault | null {
	const foundVault = useMemo((): TYDaemonVault | undefined => {
		return Object.values(vaultMap).find((vault): boolean => condition(vault));
	}, [vaultMap, condition]);

	return foundVault ? foundVault : null;
}
