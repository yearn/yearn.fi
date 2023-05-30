import React, {useMemo, useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useYBal} from '@yBal/contexts/useYBal';

import {HarvestListHead} from './HarvestsListHead';
import {HarvestListRow} from './HarvestsListRow';

import type {ReactElement} from 'react';
import type {TYDaemonHarvests} from '@common/types/yearn';

function Harvests(): ReactElement {
	const {harvests} = useYBal();
	const [category, set_category] = useState('all');

	const filteredHarvests = useMemo((): TYDaemonHarvests[] => {
		const _harvests = [...(harvests || [])];
		if (category === 'st-yBal') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === STYBAL_TOKEN_ADDRESS);
		}
		if (category === 'lp-yBal') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === LPYBAL_TOKEN_ADDRESS);
		}
		return _harvests;
	}, [category, harvests]);

	return (
		<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'flex flex-row items-center justify-between space-x-6 px-4 pt-4 pb-2 md:space-x-0 md:px-10 md:pt-10 md:pb-8'}>
				<div className={'w-1/2 md:w-auto'}>
					<h2 className={'text-lg font-bold md:text-3xl'}>{'Harvests'}</h2>
				</div>
				<div className={'flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
					<Button
						onClick={(): void => set_category('all')}
						variant={category === 'all' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-x-0'}>
						{'All'}
					</Button>
					<Button
						onClick={(): void => set_category('st-yBal')}
						variant={category === 'st-yBal' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-x-0'}>
						{'st-yBal'}
					</Button>
					<Button
						onClick={(): void => set_category('lp-yBal')}
						variant={category === 'lp-yBal' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-x-0'}>
						{'lp-yBal'}
					</Button>
				</div>
			</div>
			<div className={'mt-4 grid w-full grid-cols-1 md:mt-0'}>
				<HarvestListHead />
				{
					(filteredHarvests || [])
						.filter((harvest: TYDaemonHarvests): boolean => {
							return (
								!isZeroAddress(toAddress(harvest.vaultAddress)) &&
								[STYBAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS].includes(toAddress(harvest.vaultAddress))
							);
						}).map((harvest: TYDaemonHarvests, index: number): ReactElement => {
							return (
								<HarvestListRow
									key={`${harvest.timestamp}_${harvest.vaultAddress}_${index}`}
									harvest={harvest} />
							);
						})}
			</div>
		</div>
	);
}

export {Harvests};
