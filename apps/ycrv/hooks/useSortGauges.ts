import {useCallback, useMemo} from 'react';
import {bigNumberSort, stringSort} from '@common/utils/sort';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TCurveGauges} from '@common/types/curves';
import type {TSortDirection} from '@common/types/types';

export type TPossibleGaugesSortBy = 'gauges' | 'current-votes' | 'put-your-votes';

type TProps = {
	list: TCurveGauges[];
	gaugesVotes: TDict<BigNumber>;
	sortBy: TPossibleGaugesSortBy;
	sortDirection: TSortDirection;
	votes: TDict<BigNumber | undefined>;
};

type TSortByVotes = {
	withVotes: {
		gauge: TCurveGauges;
		votes: BigNumber
	}[];
	withoutVotes: TCurveGauges[];
}

function useSortGauges({list, gaugesVotes, sortBy, sortDirection, votes}: TProps): TCurveGauges[] {
	const sortedByName = useCallback((): TCurveGauges[] => {
		if (sortBy !== 'gauges') {
			return list;
		}
		return list.sort((a, b): number => stringSort({a: a.name, b: b.name, sortDirection}));
	}, [list, sortBy, sortDirection]);

	const sortedByCurrentVotes = useCallback((): TCurveGauges[] => {
		if (sortBy !== 'current-votes') {
			return list;
		}

		const {withVotes, withoutVotes} = list.reduce((prev, gauge): TSortByVotes => {
			const GAUGE_VOTES = gaugesVotes[gauge.gauge];
			GAUGE_VOTES ? prev.withVotes.push({gauge, votes: GAUGE_VOTES}) : prev.withoutVotes.push(gauge);
			return prev;
		}, {withVotes: [] as TSortByVotes['withVotes'], withoutVotes: [] as TSortByVotes['withoutVotes']});

		const sortedGaugesWithVotes = withVotes.sort((a, b): number => (
			bigNumberSort({a: a.votes, b: b.votes, sortDirection})
		)).map(({gauge}): TCurveGauges => gauge);

		return [...sortedGaugesWithVotes, ...withoutVotes];
	}, [gaugesVotes, list, sortBy, sortDirection]);

	const sortedByPutYourVotes = useCallback((): TCurveGauges[] => {
		if (sortBy !== 'put-your-votes') {
			return list;
		}
		const {withVotes, withoutVotes} = list.reduce((prev, gauge): TSortByVotes => {
			const gaugeVotes = votes[gauge.gauge];
			gaugeVotes ? prev.withVotes.push({gauge, votes: gaugeVotes}) : prev.withoutVotes.push(gauge);
			return prev;
		}, {withVotes: [] as TSortByVotes['withVotes'], withoutVotes: [] as TSortByVotes['withoutVotes']});

		const sortedGaugesWithVotes = withVotes.sort((a, b): number => (
			bigNumberSort({a: a.votes, b: b.votes, sortDirection})
		)).map(({gauge}): TCurveGauges => gauge);

		return [...sortedGaugesWithVotes, ...withoutVotes];
	// We don't want to sort when the votes change, hence
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortDirection, list, sortBy]);

	const sortedVaults = useMemo((): TCurveGauges[] => {
		switch (sortBy) {
			case 'gauges':
				return sortedByName();
			case 'current-votes':
				return sortedByCurrentVotes();
			case 'put-your-votes':
				return sortedByPutYourVotes();
			default:
				return list;
		}

	}, [sortBy, sortedByName, sortedByCurrentVotes, sortedByPutYourVotes, list]);

	return sortedVaults;
}

export {useSortGauges};
