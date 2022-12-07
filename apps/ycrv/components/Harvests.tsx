import React, {useMemo, useState} from 'react';
import Image from 'next/image';
import {Button} from '@yearn-finance/web-lib/components/Button';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {useYCRV} from '@yCRV/contexts/useYCRV';

import type {ReactElement} from 'react';
import type {TYDaemonHarvests} from '@common/types/yearn';

function	Harvests(): ReactElement {
	const	{harvests} = useYCRV();
	const	[category, set_category] = useState('all');

	const	filteredHarvests = useMemo((): TYDaemonHarvests[] => {
		const	_harvests = [...(harvests || [])];
		if (category === 'st-yCRV') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS);
		}
		if (category === 'lp-yCRV') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === LPYCRV_TOKEN_ADDRESS);
		}
		return _harvests;
	}, [category, harvests]);

	return (
		<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'flex flex-row items-center justify-between space-x-6 px-4 pt-4 pb-2 md:space-x-0 md:px-10 md:pt-10 md:pb-8'}>
				<div className={'w-1/2 md:w-auto'}>
					<h2 className={'text-lg font-bold md:text-3xl'}>{'Harvests'}</h2>
				</div>
				<div className={'hidden flex-row space-x-4 md:flex'}>
					<Button
						onClick={(): void => set_category('all')}
						variant={category === 'all' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'All'}
					</Button>
					<Button
						onClick={(): void => set_category('st-yCRV')}
						variant={category === 'st-yCRV' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'st-yCRV'}
					</Button>
					<Button
						onClick={(): void => set_category('lp-yCRV')}
						variant={category === 'lp-yCRV' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'lp-yCRV'}
					</Button>
				</div>
			</div>
			<div className={'grid w-full grid-cols-1'}>
				<div className={'mb-6 hidden w-full grid-cols-5 px-6 md:grid'}>
					<p className={'text-base text-neutral-400'}>{'Product'}</p>
					<p className={'text-base text-neutral-400'}>{'Gain'}</p>
					<p className={'text-base text-neutral-400'}>{'Value'}</p>
					<p className={'text-base text-neutral-400'}>{'Date'}</p>
					<p className={'text-base text-neutral-400'}>{'Transaction'}</p>
				</div>
				{(filteredHarvests || [])?.map((harvest: TYDaemonHarvests): ReactElement => {
					return (
						<div
							key={`${harvest.vaultAddress}_${harvest.timestamp}`}
							className={'grid w-full cursor-pointer grid-cols-1 border-t border-neutral-200 py-4 px-6 transition-colors hover:bg-neutral-200/30 md:grid-cols-5 md:border-none'}>
							<div className={'mb-2 flex flex-row items-center justify-between md:mb-0'}>
								<div className={'flex flex-row items-center space-x-0 md:space-x-4'}>
									<div className={'hidden h-8 w-8 rounded-full bg-neutral-200 md:flex md:h-9 md:w-9'}>
										<Image
											alt={toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
											width={36}
											height={36}
											quality={90}
											src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(harvest.vaultAddress)}/logo-128.png`}
											loading={'eager'} />
									</div>
									<b>
										{toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
									</b>
								</div>
								<div className={'flex md:hidden'}>
									<p className={'text-sm tabular-nums text-neutral-400 md:text-base md:text-neutral-900'}>
										{formatDate(Number(harvest.timestamp) * 1000)}
									</p>
								</div>
							</div>
							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Gain: '}</span>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{formatAmount(formatToNormalizedValue(formatBN(harvest.profit).sub(formatBN(harvest.loss)), 18), 2, 2)}
								</p>
							</div>

							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Value: '}</span>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{`$ ${formatAmount(Number(harvest.profitValue) - Number(harvest.lossValue), 2, 2)}`}
								</p>
							</div>

							<div className={'hidden h-9 items-center md:flex'}>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{formatDate(Number(harvest.timestamp) * 1000)}
								</p>
							</div>

							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Hash: '}</span>
								<a
									href={`https://etherscan.io/tx/${harvest.txHash}`}
									target={'_blank'}
									rel={'noreferrer'}>
									<div
										className={'flex flex-row items-center space-x-2 font-mono text-sm tabular-nums text-neutral-900'}
										style={{lineHeight: '24px'}}>
										{truncateHex(harvest.txHash, 6)}
										<IconLinkOut className={'ml-2 h-4 w-4 md:ml-4'} />
									</div>
								</a>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export {Harvests};