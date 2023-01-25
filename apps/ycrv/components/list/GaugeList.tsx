import React, {useCallback, useMemo, useReducer, useState} from 'react';
import ReactPaginate from 'react-paginate';
import {BigNumber} from 'ethers';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import IconChevron from '@common/icons/IconChevron';
import {useSortGauges} from '@yCRV/hooks/useSortGauges';

import {GaugeListEmpty} from './GaugeListEmpty';
import {GaugeListRow} from './GaugeListRow';

import type {ReactElement, ReactNode} from 'react';
import type {TPossibleGaugesSortBy, TPossibleGaugesSortDirection} from '@yCRV/hooks/useSortGauges';
import type {TUserInfo} from '@yCRV/hooks/useVLyCRV';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

type TProps = {
	gauges: TCurveGauges[];
	gaugesVotes: TDict<BigNumber>;
	isLoading: boolean;
	userInfo: TUserInfo;
}

export type TVotesReducerActionTypes = 'MAX' | 'UPDATE';

export type TVotesReducerState = {
	votes: TDict<BigNumber | undefined>;
	maxVotes: BigNumber;
	currentTotal: BigNumber;
};

export type TVotesReducerAction = {
	type: TVotesReducerActionTypes;
	gaugeAddress: TAddress;
	votes?: BigNumber;
};

type TVotesReducer = {
	state: TVotesReducerState;
	action: TVotesReducerAction;
}

function computeMaxVotesAvailable({state, action}: TVotesReducer): BigNumber {
	const prevVotes = state.votes[action.gaugeAddress] ?? 0;
	return state.maxVotes.sub(state.currentTotal.sub(prevVotes));
}

function computeNewTotal({state, action}: TVotesReducer): BigNumber {
	return state.currentTotal.sub(state.votes[action.gaugeAddress] ?? 0).add(action.votes ?? 0);
}

export function votesReducer(state: TVotesReducerState, action: TVotesReducerAction): TVotesReducerState {
	const {type, gaugeAddress, votes} = action;

	switch(type) {
		case 'MAX': {
			return {
				...state,
				votes: {...state.votes, [gaugeAddress]: computeMaxVotesAvailable({state, action})},
				currentTotal: state.maxVotes
			};
		}
		case 'UPDATE': {
			const newTotal = computeNewTotal({state, action});
			
			if (newTotal.gte(0) && newTotal.lte(state.maxVotes)) {
				return {
					...state,
					votes: {...state.votes, [gaugeAddress]: votes},
					currentTotal: newTotal
				};
			}

			return {...state, votes: {...state.votes, [gaugeAddress]: state.votes[gaugeAddress]}};
		}
		default: {
			throw Error('Unknown action: ' + type);
		}
	}
}

function createInitialState({votes, maxVotes}: Pick<TVotesReducerState, 'votes' | 'maxVotes'>): TVotesReducerState {
	return {maxVotes, votes, currentTotal: BigNumber.from(0)};
}

function GaugeList({gauges, gaugesVotes, isLoading, userInfo}: TProps): ReactElement {
	const [category, set_category] = useState('All');
	const [isSwitchEnabled, set_isSwitchEnabled] = useState(false);
	const [searchValue, set_searchValue] = useSessionStorage('yCRVGaugeSearchValue', '');
	const [sortBy, set_sortBy] = useState<TPossibleGaugesSortBy>('gauges');
	const [sortDirection, set_sortDirection] = useState<TPossibleGaugesSortDirection>('');
	const [itemOffset, set_itemOffset] = useState(0);

	const maxVotes = userInfo.balance.sub(userInfo.votesSpent);
	const [{votes, ...votesState}, votesDispatch] = useReducer(votesReducer, {votes: {}, maxVotes}, createInitialState);

	const searchedGauges = useMemo((): TCurveGauges[] => {
		if (searchValue === '') {
			return gauges;
		}

		return gauges.filter(({name}): boolean => {
			return name.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [searchValue, gauges]);


	const onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TPossibleGaugesSortBy);
			set_sortDirection(newSortDirection as TPossibleGaugesSortDirection);
		});
	}, []);

	const sortedGauges = useSortGauges({list: searchedGauges, gaugesVotes, sortBy, sortDirection, votes});

	/**
	 * Checks if there are no votes in all gauges
	 * Returns `true` if there are no votes; `false` otherwise.
	 */
	const isVotesEmpty = useCallback((): boolean => Object.values(votes).length === 0, [votes]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The GaugeList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of gauges, is some are available, or a message to the user.
	**********************************************************************************************/
	const GaugeList = useMemo((): ReactNode => {
		sortDirection; // TODO better trigger rendering when sort direction changes
		const gauges = sortedGauges.map((gauge): ReactElement | null => {
			const GAUGE_ADDRESS = gauge.gauge;
			if (!gauge || isSwitchEnabled && !votes[GAUGE_ADDRESS]) {
				return null;
			}

			return (
				<GaugeListRow
					key={GAUGE_ADDRESS}
					gauge={gauge}
					gaugeVotes={gaugesVotes[GAUGE_ADDRESS]}
					votesState={{votes, ...votesState}}
					votesDispatch={votesDispatch}
				/>
			);
		});

		if (gauges.length === 0 || (isVotesEmpty() && isSwitchEnabled)) {
			return (
				<GaugeListEmpty
					isSwitchEnabled={isSwitchEnabled}
					searchValue={searchValue}
					category={category}
					set_category={set_category}
				/>
			);
		}

		const ITEMS_PER_PAGE = 10;

		const items = gauges.filter((g: ReactElement | null): boolean => !!g);

		const handlePageClick = (event: {selected: number}): void => {
			const newOffset = (event.selected * ITEMS_PER_PAGE) % items.length;
			set_itemOffset(newOffset);
		};

		const endOffset = itemOffset + ITEMS_PER_PAGE;
		const currentItems = items.slice(itemOffset, endOffset);
		const pageCount = Math.ceil(items.length / ITEMS_PER_PAGE);

		return (
			<>
				{currentItems}
				<div className={'mt-4'}>
					<div className={'flex items-center justify-between border-t border-neutral-300 p-4 sm:px-6'}>
						<div className={'flex flex-1 justify-between sm:hidden'}>
							<a
								href={'#'}
								className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative inline-flex items-center rounded-md border  px-4 py-2 text-sm font-medium'}
							>
								{'Previous'}
							</a>
							<a
								href={'#'}
								className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative ml-3 inline-flex items-center rounded-md border  px-4 py-2 text-sm font-medium'}
							>
								{'Next'}
							</a>
						</div>
						<div className={'hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'}>
							<div>
								<p className={'text-gray-700 text-sm'}>
									{'Showing '}<span className={'font-medium'}>{endOffset - 9}</span>{' to '}<span className={'font-medium'}>{Math.min(endOffset, items.length)}</span>{' of'}{' '}
									<span className={'font-medium'}>{items.length}</span> {'results'}
								</p>
							</div>
							<ReactPaginate
								className={'isolate inline-flex -space-x-px rounded-md shadow-sm'}
								previousLinkClassName={'border-neutral-400 text-gray-500 hover:bg-neutral-300 relative inline-flex items-center rounded-l-md border  p-2 text-sm font-medium focus:z-20'}
								nextLinkClassName={'border-neutral-400 text-gray-500 hover:bg-neutral-300 relative inline-flex items-center rounded-r-md border p-2 text-sm font-medium focus:z-20'}
								breakLinkClassName={'border-neutral-400 text-gray-700 relative inline-flex items-center border px-4 py-2 text-sm font-medium hover:bg-neutral-300'}
								activeLinkClassName={'border-neutral-400 text-gray-500 hover:bg-neutral-300 relative hidden items-center border px-4 py-2 text-sm font-medium focus:z-20 md:inline-flex bg-neutral-300'}
								pageLinkClassName={'border-neutral-400 text-gray-500 hover:bg-neutral-300 relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20'}
								disabledLinkClassName={'cursor-not-allowed bg-neutral-100 hover:bg-neutral-100'}
								disabledClassName={'text-neutral-300'}
								renderOnZeroPageCount={(): null => null}
								breakLabel={'...'}
								onPageChange={handlePageClick}
								pageRangeDisplayed={5}
								pageCount={pageCount}
								nextLabel={<IconChevron className={'h-5 w-5 -rotate-90 transition-transform'} />}
								previousLabel={<IconChevron className={'h-5 w-5 rotate-90 transition-transform'} />}
							/>
						</div>
					</div>
				</div>
			</>
		);
	}, [category, gaugesVotes, isSwitchEnabled, isVotesEmpty, itemOffset, searchValue, sortDirection, sortedGauges, votes, votesState]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<ListHero
				headLabel={'Vote for Gauges'}
				switchProps={{isEnabled: isSwitchEnabled, onSwitch: (): void => set_isSwitchEnabled((p): boolean => !p)}}
				searchLabel={'Search'}
				searchPlaceholder={'f-yfieth'}
				categories={[
					[
						// {value: 'Standard', label: 'Standard', isSelected: category === 'Standard'},
						// {value: 'Factory', label: 'Factory', isSelected: category === 'Factory'},
						{value: 'All', label: 'All', isSelected: category === 'All'}

					]
				]}
				onSelect={set_category}
				searchValue={searchValue}
				set_searchValue={set_searchValue} />

			<ListHead
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={onSort}
				items={[
					{label: 'Gauges', value: 'gauges', sortable: true},
					{label: 'Current votes', value: 'current-votes', className: 'col-span-3', sortable: true},
					{label: 'Put your votes', value: 'put-your-votes', className: 'col-span-4', sortable: true},
					{label: '', value: '', className: 'col-span-1'}
				]} />

			{isLoading ? <GaugeListEmpty isLoading category={category} /> : GaugeList}
		</div>
	);
}

export default GaugeList;
