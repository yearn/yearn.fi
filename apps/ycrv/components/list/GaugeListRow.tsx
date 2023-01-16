import React from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import {QuickActions} from '../QuickActions';

import type {ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeListRow({gauge}: {gauge: TCurveGauges}): ReactElement {
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
				<div className={'yearn--table-data-section-item md:col-span-1'} datatype={''}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Multi Select'}</label>
					<b className={'yearn--table-data-section-item-value'}>
						<input type={'checkbox'} />
					</b>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-5'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Number of yCrv votes'}</label>
					<p className={'yearn--table-data-section-item-value w-full text-neutral-900'}>
						<div className={'flex h-10 items-center bg-neutral-200 p-2'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<QuickActions.Input
									label={''}
									legend={''}
									onSetMaxAmount={(): void => undefined}
									value={'0'} />
								{/* <input
									id={'toAmount'}
									className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
									type={'text'}
									value={0} /> */}
							</div>
						</div>
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Action'}</label>
					<p className={`yearn--table-data-section-item-value ${locked === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
						<Button
							onClick={alert}
							className={'w-full'}
							isBusy={false}
							isDisabled={false}>
							{'Vote'}
						</Button>
					</p>
				</div>
			</div>
		</div>
	);
}

export {GaugeListRow};
