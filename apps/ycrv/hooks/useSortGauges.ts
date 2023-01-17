import {useCallback, useMemo} from 'react';

import type {TCurveGauges} from '@common/types/curves';

export type TPossibleGaugesSortBy = 'name';
export type TPossibleGaugesSortDirection = 'asc' | 'desc' | '';

function useSortGauges(
	gaugesList: TCurveGauges[],
	sortBy: TPossibleGaugesSortBy,
	direction: TPossibleGaugesSortDirection
): TCurveGauges[] {
	const sortedByName = useCallback((): TCurveGauges[] => (
		gaugesList.sort(({name: a}, {name: b}): number => (
			direction === 'desc' ? a.localeCompare(b) : b.localeCompare(a)
		))
	), [direction, gaugesList]);

	const sortedVaults = useMemo((): TCurveGauges[] => {
		if (direction === '') {
			return gaugesList;
		}
		if (sortBy === 'name') {
			return sortedByName();
		}

		return gaugesList;
	}, [direction, sortBy, gaugesList, sortedByName]);

	return (sortedVaults);	
}

export {useSortGauges};
