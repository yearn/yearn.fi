import React, {useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {isNumber} from '@common/utils/isNumber';

import {QuickActions} from '../QuickActions';

import type {ChangeEvent, Dispatch, ReactElement, SetStateAction} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

type TGaugeListRow = {
	gauge: TCurveGauges;
	votes?: TDict<boolean>;
	set_votes: Dispatch<SetStateAction<TDict<boolean>>>
}

function	GaugeListRow({gauge, votes, set_votes}: TGaugeListRow): ReactElement {
	const [currentVotes, set_currentVotes] = useState<number>();
	const locked = 0;

	const handleVoteInput = (e: ChangeEvent<HTMLInputElement>): void => {
		if (e.target.value === '') {
			set_currentVotes(undefined);
			set_votes((p): TDict<boolean> => ({...p, [gauge.gauge]: false}));
			return;
		}

		if (isNumber(+e.target.value)) {
			set_currentVotes(+e.target.value);
			set_votes((p): TDict<boolean> => ({...p, [gauge.gauge]: true}));
			return;
		}
	};

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
				<div className={'yearn--table-data-section-item justify-center md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Current votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{0}
					</p>
				</div>

				<div className={'yearn--table-data-section-item justify-center md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Your votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{0}
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Put your votes'}</label>
					<p className={'yearn--table-data-section-item-value w-full text-neutral-900'}>
						<div className={'flex h-10 items-center bg-neutral-200'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between'}>
								<QuickActions.Input
									id={`${gauge.gauge}-votes`}
									placeholder={'0'}
									type={'number'}
									className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
									value={currentVotes}
									onSetMaxAmount={(): void => alert('Not implemented yet!')}
									onChange={handleVoteInput}
								/>
							</div>
						</div>
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-1'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{}</label>
					<p className={`yearn--table-data-section-item-value ${locked === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
						<Button
							onClick={(): void => alert(`${votes} for ${gauge.gauge}`)}
							className={'grow'}
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
