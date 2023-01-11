import React, {useMemo} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useBalance} from '@common/hooks/useBalance';

import type {ReactElement} from 'react';
import type {TYearnGauge} from '@common/types/yearn';

function	GaugeListRow({currentGauge}: {currentGauge: TYearnGauge}): ReactElement {
	const {safeChainID} = useChainID();
	const balanceOfWant = useBalance(currentGauge.token.address);
	const balanceOfCoin = useBalance(ETH_TOKEN_ADDRESS);
	const balanceOfWrappedCoin = useBalance(toAddress(currentGauge.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS);
	const deposited = useBalance(currentGauge.address)?.normalized;

	const availableToDeposit = useMemo((): number => {
		// Handle ETH native coin
		if ((toAddress(currentGauge.token.address) === WETH_TOKEN_ADDRESS) || (toAddress(currentGauge.token.address) === WFTM_TOKEN_ADDRESS)) {
			return (balanceOfWrappedCoin.normalized + balanceOfCoin.normalized);
		}
		return balanceOfWant.normalized;
	}, [balanceOfCoin.normalized, balanceOfWant.normalized, balanceOfWrappedCoin.normalized, currentGauge.token.address]);
	
	return (
		<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={currentGauge.name}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${toAddress(currentGauge.token.address)}/logo-128.png`}
							loading={'eager'} />
					</div>
					<p>{currentGauge.name}</p>
				</div>
			</div>

			<div className={'yearn--table-data-section'}>
				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={''}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Multi Select'}</label>
					<b className={'yearn--table-data-section-item-value'}>
						<input type={'checkbox'} />
					</b>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-4'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Number of yCrv votes'}</label>
					<p className={`yearn--table-data-section-item-value ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
						<div className={'flex h-10 items-center bg-neutral-300 p-2'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<input
									id={'toAmount'}
									className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
									type={'text'}
									disabled
									value={0} />
							</div>
						</div>
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Action'}</label>
					<p className={`yearn--table-data-section-item-value ${deposited === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
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
