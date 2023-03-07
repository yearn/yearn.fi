import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TVault} from '@yearn-finance/web-lib/types/vaults';

function	useFindVault(
	vaultMap: TDict<TVault>,
	condition: (v: TVault) => boolean
): TVault {
	const	foundVault = useMemo((): TVault => {
		return (Object.values(vaultMap || {}).find((vault): boolean => condition(vault as TVault)) as TVault);
	}, [vaultMap, condition]);

	return (foundVault);
}

export {useFindVault};
