import React, {useEffect, useState} from 'react';
import {utils} from 'ethers';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {isNumber} from '@common/utils/typeGuards';
import {QuickActions} from '@yCRV/components/QuickActions';

import type {BigNumber} from 'ethers';
import type {ChangeEvent, Dispatch, ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';
import type {TVotesReducerAction, TVotesReducerState} from './GaugeList';

type TGaugeListRow = {
	gauge: TCurveGauges;
	gaugeVotes: BigNumber;
	votesState: TVotesReducerState;
	votesDispatch: Dispatch<TVotesReducerAction>;
}

function GaugeListRow({gauge, gaugeVotes, votesState, votesDispatch}: TGaugeListRow): ReactElement | null {
	const [currentVotes, set_currentVotes] = useState<string>('');

	useEffect((): void => {
		const votes = votesState.votes[gauge.gauge];
		if (!votes) {
			set_currentVotes('');
			return;
		}
		const {normalized} = toNormalizedBN(votes);
		set_currentVotes(normalized.toString());
	}, [gauge.gauge, votesState.votes]);

	const handleVoteInput = ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
		if (value === '' && isTAddress(gauge.gauge)) {
			votesDispatch({type: 'UPDATE', gaugeAddress: gauge.gauge, votes: undefined});
			return;
		}
		if (isNumber(+value) && isTAddress(gauge.gauge)) {
			votesDispatch({type: 'UPDATE', gaugeAddress: gauge.gauge, votes: utils.parseUnits(String(+value), 18)});
			return;
		}
	};

	async function handleOnSetMaxAmount(): Promise<void> {
		if (isTAddress(gauge.gauge)) {
			votesDispatch({type: 'MAX', gaugeAddress: gauge.gauge});
		}
	}

	const isMaxDisabled = votesState.maxVotes.eq(votesState.currentTotal);

	return (
		<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={gauge.name}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}1/${toAddress(gauge.swap_token)}/logo-128.png`}
							loading={'eager'} />
					</div>
					<p>{gauge.name}</p>
				</div>
			</div>

			<div className={'yearn--table-data-section'}>
				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Current votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{toNormalizedBN(gaugeVotes).normalized}
					</p>
				</div>

				<div className={'yearn--table-data-section-item pt-2 md:col-span-5'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Put your votes'}</label>
					<p className={'yearn--table-data-section-item-value w-full text-neutral-900'}>
						<div className={'flex h-10 w-full flex-row items-center justify-between'}>
							<QuickActions.Input
								id={`${gauge.gauge}-votes`}
								placeholder={'0'}
								type={'number'}
								className={'w-full cursor-default overflow-x-scroll border-none bg-transparent px-0 font-bold outline-none scrollbar-none'}
								value={currentVotes}
								onSetMaxAmount={handleOnSetMaxAmount}
								onChange={handleVoteInput}
								isMaxDisabled={isMaxDisabled}
							/>
						</div>
					</p>
				</div>
			</div>
		</div>
	);
}

export {GaugeListRow};
