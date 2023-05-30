import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function useFindVault(
	vaultMap: TDict<TYDaemonVault>,
	condition: (v: TYDaemonVault) => boolean
): TYDaemonVault | null {
	const foundVault = useMemo((): TYDaemonVault | undefined => {
		return Object.values(vaultMap).find((vault): boolean => condition(vault));
	}, [vaultMap, condition]);

	return foundVault ? foundVault : null;
}

export {useFindVault};
