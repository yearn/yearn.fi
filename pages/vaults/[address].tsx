import React, {ChangeEvent, ReactElement, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {NextRouter} from 'next/router';
import {BigNumber, ethers} from 'ethers';
import useSWR from 'swr';
import {motion} from 'framer-motion';
import {Button} from '@yearn-finance/web-lib/components';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {defaultTxStatus, format, performBatchedUpdates, providers, toAddress, Transaction} from '@yearn-finance/web-lib/utils';
import VaultDetailsWrapper from 'components/apps/vaults/VaultDetails';
import Wrapper from 'components/apps/vaults/Wrapper';
import {Dropdown} from 'components/apps/ycrv/TokenDropdown';
import {ImageWithFallback} from 'components/common/ImageWithFallback';
import IconArrowRight from 'components/icons/IconArrowRight';
import {useWallet} from 'contexts/useWallet';
import {useYearn} from 'contexts/useYearn';
import {getCounterValue, handleInputChange} from 'utils';
import {approveERC20} from 'utils/actions/approveToken';
import {deposit} from 'utils/actions/deposit';
import {ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO} from 'utils/zapOptions';

import type {NextPageContext} from 'next';
import type {TDropdownOption, TNormalizedBN} from 'types/types';
import type {TYearnVault} from 'types/yearn';

const transition = {duration: 0.3, ease: 'easeInOut'};
const variants = {
	initial: {y: -80, opacity: 0, transition},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -80, opacity: 0, transition}
};


// eslint-disable-next-line @typescript-eslint/naming-convention
const		ARE_ZAP_ENABLED = false;

function	setZapOption(name: string, symbol: string, address: string): TDropdownOption {
	return ({
		label: name,
		symbol: symbol,
		value: address,
		icon: <ImageWithFallback
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${address}/logo-128.png`}
			alt={name}
			width={36}
			height={36} />
	});
}

function	VaultHeader({currentVault}: {currentVault: TYearnVault}): ReactElement {
	return (
		<div aria-label={'Vault Header'} className={'col-span-12 flex w-full flex-col items-center justify-center'}>
			<b className={'mx-auto flex w-full flex-row items-center justify-center text-center text-8xl tabular-nums text-neutral-900'}>
				&nbsp;{currentVault?.display_name || currentVault?.name || currentVault?.formated_name || ''}&nbsp;
			</b>
			<div className={'mt-10 mb-14'}>
				{currentVault?.address ? <p className={'text-xs text-neutral-500'}>{currentVault.address}</p> : <p className={'text-xs text-neutral-500'}>&nbsp;</p>}
			</div>
			<div className={'grid grid-cols-4 gap-12'}>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<b className={'text-3xl'} suppressHydrationWarning>{`$ ${format.amount(currentVault?.tvl?.tvl, 0, 0)}`}</b>
					<p className={'text-xs text-neutral-600'}>{'Total Value Locked'}</p>
				</div>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<b className={'text-3xl'} suppressHydrationWarning>{format.amount(format.toNormalizedValue(currentVault?.tvl?.total_assets, currentVault?.decimals), 0, 0)}</b>
					<p className={'text-xs text-neutral-600'}>{`Total ${currentVault?.token?.symbol} Stacked`}</p>
				</div>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<b className={'text-3xl'} suppressHydrationWarning>{`${format.amount((currentVault?.apy?.net_apy || 0) * 100, 2, 2)} %`}</b>
					<p className={'text-xs text-neutral-600'}>{'Net APY'}</p>
				</div>
				<div className={'flex flex-col items-center justify-center space-y-2'}>
					<b className={'text-3xl'} suppressHydrationWarning>{'6.9'}</b>
					<p className={'text-xs text-neutral-600'}>{'Trust score'}</p>
				</div>
			</div>
		</div>
	);
}

function	VaultQuickActions({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{isActive, provider, safeChainID} = useWeb3();
	const	{balances, refresh} = useWallet();
	const	{prices} = useYearn();
	const	[selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	const	[selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	const	[amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});

	/* 🔵 - Yearn Finance **************************************************************************
	** Init selectedOptionFrom and selectedOptionTo with the tokens matching this vault. Only
	** triggered if the variables are undefined
	**********************************************************************************************/
	useEffect((): void => {
		if (currentVault && !selectedOptionFrom && !selectedOptionTo) {
			const	_selectedFrom = setZapOption(
				currentVault?.token?.display_name || currentVault?.token?.name,
				currentVault?.token?.symbol,
				toAddress(currentVault.token.address)
			);
			const	_selectedTo = setZapOption(
				currentVault?.display_name || currentVault?.name || currentVault.formated_name,
				currentVault?.display_symbol || currentVault.symbol,
				toAddress(currentVault.address)
			);
			performBatchedUpdates((): void => {
				set_selectedOptionFrom(_selectedFrom);
				set_selectedOptionTo(_selectedTo);
			});
		}
	}, [selectedOptionFrom, selectedOptionTo, currentVault]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Grab the price of the input token to be able to perform price calculations
	**********************************************************************************************/
	const	selectedOptionFromPricePerToken = useMemo((): number => (
		format.toNormalizedValue(
			format.BN(prices?.[toAddress(selectedOptionFrom?.value)] || 0),
			6
		)
	), [prices, selectedOptionFrom]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Grab the price of the output token to be able to perform price calculations
	**********************************************************************************************/
	const	selectedOptionToPricePerToken = useMemo((): number => (
		format.toNormalizedValue(
			format.BN(prices?.[toAddress(selectedOptionTo?.value)] || 0),
			6
		)
	), [prices, selectedOptionTo]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Perform a smartContract call to the deposit contract to get the expected out for a given
	** in/out pair with a specific amount. This callback is called every 10s or when amount/in or
	** out changes.
	**********************************************************************************************/
	const expectedOutFetcher = useCallback(async (
		_inputToken: string,
		_outputToken: string,
		_amountIn: BigNumber
	): Promise<{raw: BigNumber, normalized: number}> => {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}

		const	currentProvider = provider || providers.getProvider(safeChainID);
		const	contract = new ethers.Contract(
			selectedOptionTo.value,
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = await contract.pricePerShare() || ethers.constants.Zero;
			const	expectedOutFetched = _amountIn.div(pps).mul(ethers.constants.WeiPerEther);
			return ({
				raw: expectedOutFetched,
				normalized: format.toNormalizedValue(expectedOutFetched || ethers.constants.Zero, currentVault?.decimals)
			});
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
	}, [selectedOptionFrom, selectedOptionTo, provider, safeChainID, currentVault?.decimals]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the expectedOutFetcher callback.
	**********************************************************************************************/
	const	{data: expectedOut} = useSWR(isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo ? [
		selectedOptionFrom.value,
		selectedOptionTo.value,
		amount.raw
	] : null, expectedOutFetcher, {refreshInterval: 10000, shouldRetryOnError: false});

	return (
		<div aria-label={'Quick Deposit'} className={'col-span-12 mb-4 mt-10 flex flex-row space-x-4 bg-neutral-200 p-8 md:mt-20'}>
			<div className={'w-54 space-y-2'}>
				<label className={'text-base text-neutral-600'}>{'From wallet'}</label>
				{ARE_ZAP_ENABLED ? (
					<Dropdown
						defaultOption={ZAP_OPTIONS_FROM[0]}
						options={ZAP_OPTIONS_FROM}
						selected={selectedOptionFrom}
						onSelect={(option: TDropdownOption): void => console.log(option)} />
				) : (
					<div className={'flex h-10 w-full items-center justify-between bg-neutral-100 p-2 px-3 text-base text-neutral-900'}>
						<div className={'relative flex flex-row items-center'}>
							<div className={'h-4 w-4 rounded-full md:h-6 md:w-6'}>
								{selectedOptionFrom?.icon}
							</div>
							<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
								{selectedOptionFrom?.symbol}
							</p>
						</div>
					</div>
				)}
				<legend className={'text-xs text-neutral-600'} suppressHydrationWarning>
					{`You have ${format.amount(balances[selectedOptionFrom?.value || '']?.normalized || 0, 2, 2)} ${selectedOptionFrom?.symbol || 'tokens'}`}
				</legend>
			</div>

			<div className={'w-50 space-y-2'}>
				<label className={'text-base text-neutral-600'}>{'Amount'}</label>
				<div className={'flex h-10 items-center bg-neutral-100 p-2'}>
					<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
						<input
							className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
							type={'text'}
							disabled={!isActive}
							value={amount.normalized}
							onChange={(e: ChangeEvent<HTMLInputElement>): void => {
								performBatchedUpdates((): void => {
									set_amount(handleInputChange(e, balances?.[toAddress(selectedOptionFrom?.value)]?.decimals || 18));
								});
							}} />
						<button
							onClick={(): void => {
								set_amount({
									raw: balances?.[toAddress(selectedOptionFrom?.value)]?.raw || ethers.constants.Zero,
									normalized: balances?.[toAddress(selectedOptionFrom?.value)]?.normalized || 0
								});
							}}
							className={'ml-2 cursor-pointer bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'}>
							{'Max'}
						</button>
					</div>
				</div>
				<legend className={'text-xs text-neutral-600'}>
					{getCounterValue(amount?.normalized || 0, selectedOptionFromPricePerToken)}
				</legend>
			</div>

			<div className={'w-14 space-y-2'}>
				<label className={'text-base'}>&nbsp;</label>
				<div className={'flex h-10 w-14 items-center justify-center bg-neutral-900'}>
					<IconArrowRight className={'text-neutral-0'} />
				</div>
				<legend className={'text-xs'}>&nbsp;</legend>
			</div>

			<div className={'w-54 space-y-2'}>
				<label className={'text-base text-neutral-600'}>{'To Vault'}</label>
				{ARE_ZAP_ENABLED ? (
					<Dropdown
						defaultOption={ZAP_OPTIONS_TO[0]}
						options={ZAP_OPTIONS_TO}
						selected={selectedOptionTo}
						onSelect={(option: TDropdownOption): void => console.log(option)} />
				) : (
					<div className={'flex h-10 w-full items-center justify-between bg-neutral-300 p-2 px-3 text-base text-neutral-900'}>
						<div className={'relative flex flex-row items-center'}>
							<div className={'h-4 w-4 rounded-full md:h-6 md:w-6'}>
								{selectedOptionTo?.icon}
							</div>
							<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
								{selectedOptionTo?.symbol}
							</p>
						</div>
					</div>
				)}
				<legend className={'text-xs text-neutral-600'}>
					{`APY ${format.amount((currentVault?.apy?.net_apy || 0) * 100, 0, 0)} %`}
				</legend>
			</div>

			<div className={'w-50 space-y-2'}>
				<label className={'text-base text-neutral-600'}>{'You will get'}</label>
				<div className={'flex h-10 items-center bg-neutral-300 p-2'}>
					<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
						<input
							className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
							type={'text'}
							disabled
							value={expectedOut?.normalized || 0} />
					</div>
				</div>
				<legend className={'text-xs text-neutral-600'}>
					{getCounterValue(expectedOut?.normalized || 0, selectedOptionToPricePerToken)}
				</legend>
			</div>

			<div className={'w-42 space-y-2'}>
				<label className={'text-base'}>&nbsp;</label>
				<div>
					<ActionButton
						currentVault={currentVault}
						amount={amount}
						selectedOptionFrom={selectedOptionFrom}
						selectedOptionTo={selectedOptionTo}
						onSuccess={async (): Promise<void> => {
							set_amount({raw: ethers.constants.Zero, normalized: 0});
							await refresh();
						}}
					/>
				</div>
				<legend className={'text-xs'}>&nbsp;</legend>
			</div>
		</div>
	);
}


function	ActionButton({
	currentVault,
	amount,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: {
	currentVault: TYearnVault,
	amount: TNormalizedBN;
	selectedOptionFrom?: TDropdownOption;
	selectedOptionTo?: TDropdownOption;
	onSuccess: VoidFunction;
}): ReactElement {
	const	{isActive, address, provider, safeChainID} = useWeb3();
	const	[txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const	[txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);
	const	[allowance, set_allowance] = useState(({raw: ethers.constants.Zero, normalized: 0}));

	/* 🔵 - Yearn Finance **************************************************************************
	** Perform a smartContract call to the deposit contract to get the allowance for the deposit
	** action. This is only refreshed if the amount typed in the input change to be bigger than the
	** current state allowance. Default state allowance is 0, so it will be refreshed on the first
	** render.
	**********************************************************************************************/
	const allowanceFetcher = useCallback(async (inputToken: string, outputToken: string): Promise<{raw: BigNumber, normalized: number}> => {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}

		const	currentProvider = provider || providers.getProvider(safeChainID);
		const	contract = new ethers.Contract(
			inputToken,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			currentProvider
		);
		try {
			const	tokenAllowance = await contract.allowance(address, outputToken) || ethers.constants.Zero;
			const	effectiveAllowance = ({
				raw: tokenAllowance,
				normalized: format.toNormalizedValue(tokenAllowance || ethers.constants.Zero, currentVault?.decimals)
			});
			set_allowance(effectiveAllowance);
			return effectiveAllowance;
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
	}, [address, currentVault?.decimals, provider, safeChainID, selectedOptionFrom, selectedOptionTo]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: allowanceFrom, isValidating: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo && allowance.raw.lte(amount.raw) ? [
			selectedOptionFrom.value,
			selectedOptionTo.value
		] : null, allowanceFetcher, {revalidateOnFocus: false}
	);


	/* 🔵 - Yearn Finance ******************************************************
	** Approve the spending of token A by the corresponding ZAP contract to
	** perform the swap.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return;
		}
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			toAddress(selectedOptionTo.value), //vault spender
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
			console.log('allowance mutated');
		}).perform();
	}


	/* 🔵 - Yearn Finance ******************************************************
	** Execute a zap using the ZAP contract to migrate from a token A to a
	** supported token B.
	**************************************************************************/
	async function	onDeposit(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, deposit, set_txStatusDeposit).populate(
			toAddress(selectedOptionTo.value), //destination vault
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
		
	}

	if (txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0)) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero()}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	return (
		<Button
			onClick={onDeposit}
			className={'w-full'}
			isBusy={txStatusDeposit.pending}
			isDisabled={!isActive || amount.raw.isZero()}>
			{'Deposit'}
		</Button>
	);

}

function	Index({router, vaultData}: {router: NextRouter, vaultData: TYearnVault}): ReactElement {
	const	{vaults} = useYearn();
	const	currentVault = useRef<TYearnVault>(vaults[toAddress(router.query.address as string)] as TYearnVault || {current: vaultData});

	return (
		<>
			<header className={'relative z-50 flex w-full items-center justify-center'}>
				<motion.div
					key={'vaults'}
					initial={'initial'}
					animate={'enter'}
					variants={variants}
					className={'absolute z-50 -mt-36 cursor-pointer'}>
					<ImageWithFallback
						src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(currentVault.current.token.address)}/logo-128.png`}
						alt={''}
						width={72}
						height={72} />
				</motion.div>
			</header>

			<section className={'mt-4 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<VaultHeader currentVault={currentVault.current} />
				<VaultQuickActions currentVault={currentVault.current} />
				<VaultDetailsWrapper currentVault={currentVault.current} />
			</section>
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;

Index.getInitialProps = async ({req}: NextPageContext): Promise<unknown> => {
	const	address = toAddress(req?.url?.split('/').pop() || '');
	const	res = await fetch(`${process.env.YDAEMON_BASE_URI}/1/vaults/${address}?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk`);
	const	json = await res.json();

	return {vaultData: json};
};
