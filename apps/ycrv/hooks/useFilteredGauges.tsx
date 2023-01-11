import {useMemo} from 'react';

import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnGauge} from '@common/types/yearn';

function	useFilteredGauges(
	gaugeMap: TDict<TYearnGauge | undefined>,
	condition: (v: TYearnGauge) => boolean
): TYearnGauge[] {
	const	filtered = useMemo((): TYearnGauge[] => {
		return (Object.values(gaugeMap || {}).filter((gauge): boolean => condition(gauge as TYearnGauge)) as TYearnGauge[]);
	}, [gaugeMap, condition]);

	return (filtered);	
}

export {useFilteredGauges};
