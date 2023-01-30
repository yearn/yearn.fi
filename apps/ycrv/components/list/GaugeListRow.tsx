import React from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {isNumber} from '@common/utils/isNumber';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';

import {QuickActions} from '../QuickActions';

import type {ethers} from 'ethers';
import type {ChangeEvent, Dispatch, ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';
import type {TVotesReducerAction, TVotesReducerState} from './GaugeList';

type TGaugeListRow = {
	gauge: TCurveGauges;
	votesState: TVotesReducerState;
	votesDispatch: Dispatch<TVotesReducerAction>;
}

function	GaugeListRow({gauge, votesState, votesDispatch}: TGaugeListRow): ReactElement | null {
	const {vote} = useVLyCRV();
	const {provider} = useWeb3();
	const currentVotes = votesState.votes[gauge.gauge];

	const handleVoteInput = ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
		if (value === '') {
			votesDispatch({type: 'update', gauge: gauge.gauge, votes: undefined});
			return;
		}
		if (isNumber(+value)) {
			votesDispatch({type: 'update', gauge: gauge.gauge, votes: +value});
			return;
		}
	};

	async function handleOnVote(): Promise<void> {
		vote({
			provider: provider as ethers.providers.Web3Provider,
			gaugeAddress: gauge.gauge,
			votes: currentVotes
		});
	}

	async function handleOnSetMaxAmount(): Promise<void> {
		votesDispatch({type: 'max', gauge: gauge.gauge});
	}

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
				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Current votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{0}
					</p>
				</div>

				<div className={'yearn--table-data-section-item pt-2 md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Your votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{0}
					</p>
				</div>

				<div className={'yearn--table-data-section-item pt-2 md:col-span-3'}>
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
								isMaxDisabled={votesState.maxVotes.eq(votesState.currentTotal)}
							/>
						</div>
					</p>
				</div>

				<div className={'yearn--table-data-section-item pt-2 md:col-span-1'}>
					<p className={'yearn--table-data-section-item-value w-full'}>
						<Button
							onClick={handleOnVote}
							className={'w-full'}
							isDisabled={!currentVotes}>
							{'Vote'}
						</Button>
					</p>
				</div>
			</div>
		</div>
	);
}

export {GaugeListRow};
