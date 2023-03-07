import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TVault} from '@yearn-finance/web-lib/types/vaults';

function	useFilteredVaults(
	vaultMap: TDict<TVault>,
	condition: (v: TVault) => boolean
): TVault[] {
	const	filtered = useMemo((): TVault[] => {
		return (Object.values(vaultMap || {}).filter((vault): boolean => condition(vault as TVault)) as TVault[]);
	}, [vaultMap, condition]);

	return (filtered);
}

export {useFilteredVaults};
