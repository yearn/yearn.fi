import React, {useMemo, useState} from 'react';
import Balancer from 'react-wrap-balancer';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {HeroTimer} from '@common/components/HeroTimer';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import GaugeList from '@yCRV/components/list/GaugeList';
import {QuickActions} from '@yCRV/components/QuickActions';
import {ST_YCRV, YCRV} from '@yCRV/constants/tokens';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';
import Wrapper from '@yCRV/Wrapper';

import type {NextRouter} from 'next/router';
import type {ChangeEvent, ReactElement} from 'react';
import type {TQAInput, TQASelect, TQASwitch} from '@yCRV/components/QuickActions';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function Vote(): ReactElement {
	const {isActive} = useWeb3();
	const {balances} = useWallet();
	const {nextPeriod, userInfo} = useVLyCRV();
	const {gauges, isLoadingGauges} = useCurve();
	const [isLocking, set_isLocking] = useState(true);
	const yCRVBalance = useBalance(YCRV.value);
	const stYCRVBalance = useBalance(ST_YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerYCRV = useTokenPrice(toAddress(YCRV.value));
	const pricePerSTYCRV = useTokenPrice(toAddress(ST_YCRV.value));

	const fromSelectProps: TQASelect = useMemo((): TQASelect => {
		if (isLocking) {
			const legend = `You have ${formatAmount(yCRVBalance.normalized)} ${yCRVBalance?.symbol || 'tokens'}`;
			return {label: 'From wallet', legend, options: [YCRV], selected: YCRV};
		}
		
		const legend = `You have ${formatAmount(stYCRVBalance.normalized)} ${stYCRVBalance?.symbol || 'tokens'}`;
		return {label: 'From vault', legend, options: [ST_YCRV], selected: ST_YCRV};
	}, [isLocking, stYCRVBalance.normalized, stYCRVBalance?.symbol, yCRVBalance.normalized, yCRVBalance?.symbol]);

	const maxLockingPossible = useMemo((): TNormalizedBN => {
		if (isLocking) {
			const balance = yCRVBalance.raw || ethers.constants.Zero;
			return (toNormalizedBN(balance.toString(), yCRVBalance.decimals));
		}
		
		const balance = stYCRVBalance.raw || ethers.constants.Zero;
		return (toNormalizedBN(balance.toString(), stYCRVBalance.decimals));
	}, [isLocking, stYCRVBalance.decimals, stYCRVBalance.raw, yCRVBalance.decimals, yCRVBalance.raw]);

	const fromInputProps: TQAInput = useMemo((): TQAInput => ({
		onChange: ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
			const decimals = balances?.[toAddress(isLocking ? YCRV.value : ST_YCRV.value)]?.decimals || 18;
			if (value === '') {
				set_amount(undefined);
				return;
			}
			set_amount(handleInputChangeEventValue(value, decimals));
		},
		value: amount ? amount.normalized : '',
		onSetMaxAmount: (): void => set_amount(maxLockingPossible),
		label: 'Amount',
		legend: formatCounterValue(amount?.normalized || 0, isLocking ? pricePerYCRV : pricePerSTYCRV),
		isDisabled: !isActive
	}), [amount, balances, isActive, isLocking, maxLockingPossible, pricePerSTYCRV, pricePerYCRV]);

	const switchProps: TQASwitch = useMemo((): TQASwitch => ({
		tooltipText: isLocking ? 'Withdraw' : 'Lock',
		onSwitchFromTo: (): void => {
			set_isLocking((prev): boolean => !prev);
			set_amount(isLocking ? {raw: ethers.constants.Zero, normalized: 0} : maxLockingPossible);
		}
	}), [isLocking, maxLockingPossible]);
	
	const toSelectProps: TQASelect = useMemo((): TQASelect => {
		if (isLocking) {
			return {label: 'To vault', options: [ST_YCRV], selected: ST_YCRV};
		}

		return {label: 'To wallet', options: [YCRV], selected: YCRV};
	}, [isLocking]);

	const toInputProps: TQAInput = useMemo((): TQAInput => ({
		value: amount?.normalized ?? 0,
		label: 'You will receive',
		isDisabled: true
	}), [amount]);

	const buttonProps = {
		label: isLocking ? 'Lock' : 'Withdraw'
	};

	const {balance, lastVoteTime, votesSpent} = userInfo;

	const totalVotes = formatToNormalizedValue(balance);
	const remainingVotesForThisPeriod = formatToNormalizedValue(balance.sub(votesSpent));

	return (
		<>
			<HeroTimer endTime={nextPeriod} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<div className={'mb-10 md:mb-14'}>
					<b className={'text-center text-lg md:text-2xl'}>{'Time left till next period'}</b>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-12'}>
					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{totalVotes}
						</b>
						<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Total Votes'}
						</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{remainingVotesForThisPeriod}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'}>{'Remaining Votes for this period'}</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{formatDate(lastVoteTime)}
						</b>
						<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Last vote'}
						</legend>
					</div>
				</div>
			</div>
			<section className={'mt-10 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<div
					aria-label={'Quick Actions'}
					className={'col-span-12 mb-4 bg-neutral-200'}>
					<div className={'p-4 pb-0 md:p-8 md:pb-0'}>
						<Balancer>
							<h2 suppressHydrationWarning className={'pb-2 text-lg font-bold md:pb-4 md:text-3xl'}>{'Get your vote on.'}</h2>
							<p>{'Deposit vanilla yCRV for vote locked yCRV (vl-yCRV) and gain vote power for Curve voting. Each vote period lasts for two weeks, and your tokens cannot be withdrawn until the end of the following period.\nPlease note, vl-yCRV does not generate yield but maintains a 1:1 exchange rate with yCRV (so if yCRV increases in value, so will your vl-yCRV). '}</p>
						</Balancer>
					</div>
					<div className={'col-span-12 flex flex-col space-x-0 space-y-2 p-4 md:flex-row md:space-x-4 md:space-y-0 md:p-8'}>
						<QuickActions label={'voteFrom'}>
							<QuickActions.Select {...fromSelectProps} />
							<QuickActions.Input {...fromInputProps} />
						</QuickActions>
						<QuickActions.Switch {...switchProps} />
						<QuickActions label={'voteTo'}>
							<QuickActions.Select {...toSelectProps} />
							<QuickActions.Input {...toInputProps} />
						</QuickActions>
						<QuickActions.Button {...buttonProps} />
					</div>
				</div>
				<GaugeList gauges={gauges} isLoadingGauges={isLoadingGauges} />
			</section>
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
