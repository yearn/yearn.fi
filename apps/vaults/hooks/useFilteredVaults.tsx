import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

function	useFilteredVaults(
	vaultMap: TDict<TYearnVault | undefined>,
	condition: (v: TYearnVault) => boolean
): TYearnVault[] {
	const	filtered = useMemo((): TYearnVault[] => {
		return (Object.values(vaultMap || {}).filter((vault): boolean => condition(vault as TYearnVault)) as TYearnVault[]);
	}, [vaultMap, condition]);

	return (filtered);	
}

export {useFilteredVaults};
