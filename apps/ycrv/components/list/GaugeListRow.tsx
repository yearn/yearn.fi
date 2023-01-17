import React, {useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {isNumber} from '@common/utils/isNumber';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
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
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Your votes'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{0}
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-4'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Put your votes'}</label>
					<p className={'yearn--table-data-section-item-value w-full text-neutral-900'}>
						<div className={'flex h-10 items-center bg-neutral-200 p-2'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<input
									id={'toAmount'}
									className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
									type={'number'}
									placeholder={'0'}
									onChange={({target: {value}}): void => {
										if (isNumber(+value)) {
											set_currentVotes(+value);
											set_votes((p): TDict<boolean> => ({
												...p,
												[gauge.gauge]: true
											}));
											return;
										}
										set_votes((p): TDict<boolean> => ({
											...p,
											[gauge.gauge]: false
										}));
									}}
									value={currentVotes}
								/>
							</div>
						</div>
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Action'}</label>
					<p className={`yearn--table-data-section-item-value ${locked === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
						<Button
							onClick={(): void => alert(`${votes} for ${gauge.gauge}`)}
							className={'w-full'}
							isBusy={false}
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
