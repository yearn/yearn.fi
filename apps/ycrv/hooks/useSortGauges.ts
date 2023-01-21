import {useCallback, useMemo} from 'react';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

export type TPossibleGaugesSortBy = 'gauges' | 'put-your-votes';
export type TPossibleGaugesSortDirection = 'asc' | 'desc' | '';

type TProps = {
	list: TCurveGauges[];
	sortBy: TPossibleGaugesSortBy;
	sortDirection: TPossibleGaugesSortDirection;
	votes: TDict<BigNumber | undefined>;
};

type TSortByNotSubmittedVotes = {
	withVotes: {
		gauge: TCurveGauges;
		votes: BigNumber
	}[];
	withoutVotes: TCurveGauges[];
}

function useSortGauges({list, sortBy, sortDirection, votes}: TProps): TCurveGauges[] {
	const sortedByName = useCallback((): TCurveGauges[] => {
		if (sortBy !== 'gauges') {
			return list;
		}
		return list.sort((a, b): number => (
			sortDirection === 'desc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
		));
	}, [sortDirection, list, sortBy]);

	const sortedByPutYourVotes = useCallback((): TCurveGauges[] => {
		if (sortBy !== 'put-your-votes') {
			return list;
		}
		const {withVotes, withoutVotes} = list.reduce((prev, gauge): TSortByNotSubmittedVotes => {
			const gaugeVotes = votes[gauge.gauge];
			gaugeVotes ? prev.withVotes.push({gauge, votes: gaugeVotes}) : prev.withoutVotes.push(gauge);
			return prev;
		}, {withVotes: [] as TSortByNotSubmittedVotes['withVotes'], withoutVotes: [] as TSortByNotSubmittedVotes['withoutVotes']});

		const sortedGaugesWithVotes = withVotes.sort((a, b): number => {
			return sortDirection === 'desc'
				? Number(toNormalizedBN(a.votes.sub(b.votes)).normalized)
				: Number(toNormalizedBN(b.votes.sub(a.votes)).normalized);
		});

		return [...sortedGaugesWithVotes.map(({gauge}): TCurveGauges => gauge), ...withoutVotes];
	// We don't want to sort when the votes change, hence
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortDirection, list, sortBy]);

	const sortedVaults = useMemo((): TCurveGauges[] => {
		if (sortBy === 'gauges') {
			return sortedByName();
		}
		if (sortBy === 'put-your-votes') {
			return sortedByPutYourVotes();
		}

		return list;
	}, [sortBy, list, sortedByName, sortedByPutYourVotes]);

	return sortedVaults;
}

export {useSortGauges};
