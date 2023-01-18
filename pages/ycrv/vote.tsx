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
import {useTabs} from '@common/hooks/useTabs';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import GaugeList from '@yCRV/components/list/GaugeList';
import {QuickActions} from '@yCRV/components/QuickActions';
import {VL_YCRV, YCRV} from '@yCRV/constants/tokens';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';
import Wrapper from '@yCRV/Wrapper';

import type {NextRouter} from 'next/router';
import type {ChangeEvent, ReactElement} from 'react';
import type {TQAInput, TQASelect} from '@yCRV/components/QuickActions';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function Deposit(): ReactElement {
	const {isActive} = useWeb3();
	const {balances} = useWallet();
	const yCRVBalance = useBalance(YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerYCRV = useTokenPrice(toAddress(YCRV.value));

	const fromSelectProps: TQASelect = useMemo((): TQASelect => {
		const legend = `You have ${formatAmount(yCRVBalance.normalized)} ${yCRVBalance?.symbol || 'tokens'}`;
		return {label: 'From wallet', legend, options: [YCRV], selected: YCRV};
	}, [yCRVBalance.normalized, yCRVBalance?.symbol]);

	const maxLockingPossible = useMemo((): TNormalizedBN => {
		const balance = yCRVBalance.raw || ethers.constants.Zero;
		return (toNormalizedBN(balance.toString(), yCRVBalance.decimals));
	}, [yCRVBalance.decimals, yCRVBalance.raw]);

	const fromInputProps: TQAInput = useMemo((): TQAInput => ({
		onChange: ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
			const decimals = balances?.[toAddress(YCRV.value)]?.decimals || 18;
			if (value === '') {
				set_amount(undefined);
				return;
			}
			set_amount(handleInputChangeEventValue(value, decimals));
		},
		value: amount ? amount.normalized : '',
		onSetMaxAmount: (): void => set_amount(maxLockingPossible),
		label: 'Amount',
		legend: formatCounterValue(amount?.normalized || 0, pricePerYCRV),
		isDisabled: !isActive,
		placeholder: '0'
	}), [amount, balances, isActive, maxLockingPossible, pricePerYCRV]);

	
	const toInputProps: TQAInput = useMemo((): TQAInput => ({
		value: amount?.normalized ?? 0,
		label: 'You will get',
		isDisabled: true
	}), [amount]);
	
	return useMemo((): ReactElement => {
		const toSelectProps: TQASelect = {label: 'To vault', options: [VL_YCRV], selected: VL_YCRV};

		const buttonProps = {
			label: 'Deposit'
		};

		return (
			<div
				aria-label={'Quick Actions'}
				className={'col-span-12 mb-4'}>
				<div className={'col-span-12 flex flex-col space-x-0 space-y-2 md:flex-row md:space-x-4 md:space-y-0'}>
					<QuickActions label={'voteFrom'}>
						<QuickActions.Select {...fromSelectProps} />
						<QuickActions.Input {...fromInputProps} />
					</QuickActions>
					<QuickActions.Switch />
					<QuickActions label={'voteTo'}>
						<QuickActions.Select {...toSelectProps} />
						<QuickActions.Input {...toInputProps} />
					</QuickActions>
					<QuickActions.Button {...buttonProps} />
				</div>
			</div>
		);
	}, [fromInputProps, fromSelectProps, toInputProps]);
}

function Withdraw(): ReactElement {
	const {isActive} = useWeb3();
	const {balances} = useWallet();
	const stYCRVBalance = useBalance(VL_YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerSTYCRV = useTokenPrice(toAddress(VL_YCRV.value));

	const fromSelectProps: TQASelect = useMemo((): TQASelect => {
		const legend = `You have ${formatAmount(stYCRVBalance.normalized)} ${stYCRVBalance?.symbol || 'tokens'}`;
		return {label: 'From vault', legend, options: [VL_YCRV], selected: VL_YCRV};
	}, [stYCRVBalance.normalized, stYCRVBalance?.symbol]);

	const maxLockingPossible = useMemo((): TNormalizedBN => {
		const balance = stYCRVBalance.raw || ethers.constants.Zero;
		return (toNormalizedBN(balance.toString(), stYCRVBalance.decimals));
	}, [stYCRVBalance.decimals, stYCRVBalance.raw]);

	const fromInputProps: TQAInput = useMemo((): TQAInput => ({
		onChange: ({target: {value}}: ChangeEvent<HTMLInputElement>): void => {
			const decimals = balances?.[toAddress(VL_YCRV.value)]?.decimals || 18;
			if (value === '') {
				set_amount(undefined);
				return;
			}
			set_amount(handleInputChangeEventValue(value, decimals));
		},
		value: amount ? amount.normalized : '',
		onSetMaxAmount: (): void => set_amount(maxLockingPossible),
		label: 'Amount',
		legend: formatCounterValue(amount?.normalized || 0, pricePerSTYCRV),
		isDisabled: !isActive,
		placeholder: '0'
	}), [amount, balances, isActive, maxLockingPossible, pricePerSTYCRV]);

	
	const toInputProps: TQAInput = useMemo((): TQAInput => ({
		value: amount?.normalized ?? 0,
		label: 'You will get',
		isDisabled: true
	}), [amount]);
	
	return useMemo((): ReactElement => {
		const toSelectProps: TQASelect = {label: 'To wallet', options: [YCRV], selected: YCRV};

		const buttonProps = {
			label: 'Withdraw'
		};

		return (
			<div
				aria-label={'Quick Actions'}
				className={'col-span-12 mb-4'}>
				<div className={'col-span-12 flex flex-col space-x-0 space-y-2 md:flex-row md:space-x-4 md:space-y-0'}>
					<QuickActions label={'voteFrom'}>
						<QuickActions.Select {...fromSelectProps} />
						<QuickActions.Input {...fromInputProps} />
					</QuickActions>
					<QuickActions.Switch />
					<QuickActions label={'voteTo'}>
						<QuickActions.Select {...toSelectProps} />
						<QuickActions.Input {...toInputProps} />
					</QuickActions>
					<QuickActions.Button {...buttonProps} />
				</div>
			</div>
		);
	}, [fromInputProps, fromSelectProps, toInputProps]);
}

function HowItWorks(): ReactElement {
	return (
		<div
			aria-label={'Quick Actions'}
			className={'col-span-12 mb-4'}>
			<Balancer>
				<h2 suppressHydrationWarning className={'pb-2 text-lg font-bold md:pb-4 md:text-3xl'}>{'Get your vote on.'}</h2>
				<p>{'Deposit vanilla yCRV for vote locked yCRV (vl-yCRV) and gain vote power for Curve voting. Each vote period lasts for two weeks, and your tokens cannot be withdrawn until the end of the following period.\nPlease note, vl-yCRV does not generate yield but maintains a 1:1 exchange rate with yCRV (so if yCRV increases in value, so will your vl-yCRV). '}</p>
			</Balancer>
		</div>
	);
}

function Vote(): ReactElement {
	const {nextPeriod, userInfo} = useVLyCRV();
	const {gauges, isLoadingGauges} = useCurve();
	const {component: Tabs} = useTabs({
		items: [
			{id: 'deposit', label: 'Deposit', content: <Deposit />},
			{id: 'withdraw', label: 'Withdraw', content: <Withdraw />},
			{id: 'how-it-works', label: 'How it works', content: <HowItWorks />}
		]
	});

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
			<div className={'mb-10'}>
				{Tabs}
			</div>
			<GaugeList gauges={gauges} isLoadingGauges={isLoadingGauges} />
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
