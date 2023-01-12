import {useCallback, useMemo} from 'react';

import type {TYearnGauge} from '@common/types/yearn';

export type TGaugesPossibleSortBy = 'name' | 'votes';
export type TGaugesPossibleSortDirection = 'asc' | 'desc' | '';

function	useSortGauges(
	gaugeList: TYearnGauge[],
	sortBy: TGaugesPossibleSortBy,
	sortDirection: TGaugesPossibleSortDirection
): TYearnGauge[] {
	const	sortedByName = useCallback((): TYearnGauge[] => (
		gaugeList.sort((a, b): number => {
			if (sortDirection === 'desc') {
				return a.name.localeCompare(b.name);
			}
			return b.name.localeCompare(a.name);
		})
	), [gaugeList, sortDirection]);

	const	sortedByVotes = useCallback((): TYearnGauge[] => (
		gaugeList.sort((a, b): number => {
			if (sortDirection === 'desc') {
				return (b.votes || 0) - (a.votes || 0);
			}
			return (a.votes || 0) - (b.votes || 0);
		})
	), [gaugeList, sortDirection]);


	const	stringifiedGaugeList = JSON.stringify(gaugeList);
	const	sortedGauges = useMemo((): TYearnGauge[] => {
		const	sortResult = JSON.parse(stringifiedGaugeList);
		if (sortDirection === '') {
			return sortResult;
		}

		if (sortBy === 'name') {
			return sortedByName();
		}
		
		if (sortBy === 'votes') {
			return sortedByVotes();
		}

		return sortResult;
	}, [sortBy, sortDirection, sortedByName, sortedByVotes, stringifiedGaugeList]);

	return (sortedGauges);	
}

export {useSortGauges};
