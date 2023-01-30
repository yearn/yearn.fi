import React, {useMemo, useState} from 'react';
import Balancer from 'react-wrap-balancer';
import {BigNumber, ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {computeTimeLeft, HeroTimer} from '@common/components/HeroTimer';
import {Tabs} from '@common/components/Tabs';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {formatDateShort} from '@common/utils';
import GaugeList from '@yCRV/components/list/GaugeList';
import {QuickActions} from '@yCRV/components/QuickActions';
import {VL_YCRV, YCRV} from '@yCRV/constants/tokens';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';
import Wrapper from '@yCRV/Wrapper';

import HowItWorksDiagram from './illustrations/how-it-works';

import type {NextRouter} from 'next/router';
import type {ChangeEvent, ReactElement} from 'react';
import type {TQAButton, TQAInput, TQASelect} from '@yCRV/components/QuickActions';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

function Deposit(): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances} = useWallet();
	const yCRVBalance = useBalance(YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerYCRV = useTokenPrice(toAddress(YCRV.value));
	const {deposit} = useVLyCRV();

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
			set_amount(value === '' ? undefined : handleInputChangeEventValue(value, decimals));
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
		
		async function onDeposit(): Promise<void> {
			deposit({amount: amount?.raw ? amount?.raw : BigNumber.from(0), provider: provider as ethers.providers.Web3Provider});
		}

		const buttonProps: TQAButton = {
			label: 'Deposit',
			onClick: onDeposit,
			isDisabled: !isActive || !amount?.raw.gt(0)
		};

		return (
			<div aria-label={'yCRV Deposit'} className={'col-span-12 mb-4'}>
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
	}, [amount?.raw, deposit, fromInputProps, fromSelectProps, isActive, provider, toInputProps]);
}

function Withdraw(): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances} = useWallet();
	const stYCRVBalance = useBalance(VL_YCRV.value);
	const [amount, set_amount] = useState<TNormalizedBN | undefined>({raw: ethers.constants.Zero, normalized: 0});
	const pricePerSTYCRV = useTokenPrice(toAddress(VL_YCRV.value));
	const {withdraw} = useVLyCRV();

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

		async function onWithdraw(): Promise<void> {
			withdraw({amount: amount?.raw ? amount?.raw : BigNumber.from(0), provider: provider as ethers.providers.Web3Provider});
		}

		const buttonProps: TQAButton = {
			label: 'Withdraw',
			onClick: onWithdraw,
			isDisabled: !isActive || !amount?.raw.gt(0)
		};

		return (
			<div
				aria-label={'yCRV Withdraw'}
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
	}, [amount?.raw, fromInputProps, fromSelectProps, isActive, provider, toInputProps, withdraw]);
}

function HowItWorks(): ReactElement {
	return (
		<div
			aria-label={'Quick Actions'}
			className={'col-span-12'}>
			<Balancer>
				<h2 suppressHydrationWarning className={'pb-2 text-lg font-bold md:pb-4 md:text-3xl'}>{'Deposit'}</h2>
				<p>{'Deposit vanilla yCRV for vote locked yCRV (vl-yCRV) and gain vote power for Curve voting. Let’s learn about the fun way that Curve voting works. Each vote period lasts for two weeks, and once you vote in the ‘current period’ (as shown below) your tokens cannot be withdrawn until after the ‘next period’. Voting in the next period (once it becomes the current period) would again lock your tokens for a further period. Please note, vl-yCRV does not generate yield but maintains a 1:1 exchange rate with yCRV (so if yCRV increases in value, so will your vl-yCRV).'}</p>
				<h2 suppressHydrationWarning className={'mt-4 pb-2 text-lg font-bold md:mt-8 md:pb-4 md:text-3xl'}>{'Withdraw'}</h2>
				<p>{'Once you vote in the ‘current period’ (as shown below), you must wait until the end of the ‘next period’ in order to withdraw your vl-yCRV back to yCRV. However, if you choose to also vote in the ‘next period’ once it becomes the ‘current period’ you would then have to wait until the end of the following period (without voting in it) in order to withdraw. In other words, once you vote in the ‘current period’ you must wait for the ‘next period’ to end without voting in it to withdraw. Who said DeFi was complicated...'}</p>
			</Balancer>
			<p className={'p-16 pb-0'}>
				<HowItWorksDiagram />
			</p>
		</div>
	);
}

function Vote(): ReactElement {
	const {isActive} = useWeb3();
	// const {initialData: {nextPeriod, userInfo, getVotesUnpacked}} = useVLyCRV();
	const {initialData: {nextPeriod}} = useVLyCRV();
	const {gauges, isLoadingGauges} = useCurve();

	// Fake it until you make it
	const MOCK_USER_INFO = {
		balance: BigNumber.from('100000000000000000000'),
		votesSpent: BigNumber.from('50000000000000000000'),
		lastVoteTime: 1674217683000
	};

	const MOCK_GET_VOTES_UNPACKED: {
		gaugesList: string[];
		voteAmounts: BigNumber[];
	} = {
		gaugesList: [
			'0xDB190E4d9c9A95fdF066b258892b8D6Bb107434e',
			'0x6a69FfD1353Fa129f7F9932BB68Fa7bE88F3888A',
			'0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1'
		],
		voteAmounts: [
			BigNumber.from('10000000000000000000000'),
			BigNumber.from('2000000000000000000000'),
			BigNumber.from('300000000000000000000')
		]
	};

	const {gaugesList, voteAmounts} = MOCK_GET_VOTES_UNPACKED;
	const gaugesVotes = useMemo((): TDict<BigNumber> => {
		return gaugesList.reduce((prev, curr, i): TDict<BigNumber> => ({...prev, [curr]: voteAmounts[i]}), {});
	}, [gaugesList, voteAmounts]);

	// const {balance, lastVoteTime, votesSpent} = userInfo;
	const {balance, lastVoteTime, votesSpent} = MOCK_USER_INFO;
	const totalVotes = formatToNormalizedValue(balance);
	const remainingVotesForThisPeriod = formatToNormalizedValue(balance.sub(votesSpent));

	const ONE_DAY_MS = 24 * 60 * 60 * 1000;
	const timeLeft = computeTimeLeft({endTime: nextPeriod});
	const isLessThan1Day = isActive && !!nextPeriod && timeLeft < ONE_DAY_MS;

	return (
		<>
			<HeroTimer endTime={nextPeriod} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<div className={'mb-10 md:mb-14'}>
					{isLessThan1Day && !!timeLeft ? 
						<p className={'text-2xl font-bold text-[#8F0000]'}>{'Last day to vote!'}</p>
						:
						<b className={'text-center text-lg md:text-2xl'}>{'Time left till next period'}</b>
					}
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-12'}>
					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{totalVotes}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Your total votes'}
						</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{remainingVotesForThisPeriod}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'}>{'Your remaining votes'}</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{lastVoteTime ? formatDateShort(lastVoteTime) : '—'}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Your last vote'}
						</legend>
					</div>
				</div>
			</div>
			<div className={'mb-10'}>
				<Tabs
					items={[
						{id: 'deposit', label: 'Deposit', content: <Deposit />},
						{id: 'withdraw', label: 'Withdraw', content: <Withdraw />},
						{id: 'how-it-works', label: 'How it works', content: <HowItWorks />}
					]} />
			</div>
			<GaugeList
				gauges={gauges}
				gaugesVotes={gaugesVotes}
				isLoading={isLoadingGauges}
				userInfo={MOCK_USER_INFO} />
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
