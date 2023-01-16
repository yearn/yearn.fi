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
	), [gaugesList, direction]);


	const stringifiedVaultList = JSON.stringify(gaugesList);
	const sortedVaults = useMemo((): TCurveGauges[] => {
		const sortResult = JSON.parse(stringifiedVaultList);
		if (direction === '') {
			return sortResult;
		}
		if (sortBy === 'name') {
			return sortedByName();
		}

		return sortResult;
	}, [sortBy, direction, sortedByName, stringifiedVaultList]);

	return (sortedVaults);	
}

export {useSortGauges};
