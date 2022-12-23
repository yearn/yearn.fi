import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

function	useFindVault(
	vaultMap: TDict<TYearnVault | undefined>,
	condition: (v: TYearnVault) => boolean
): TYearnVault {
	const	foundVault = useMemo((): TYearnVault => {
		return (Object.values(vaultMap || {}).find((vault): boolean => condition(vault as TYearnVault)) as TYearnVault);
	}, [vaultMap, condition]);

	return (foundVault);	
}

export {useFindVault};
