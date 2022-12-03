import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {Button} from '@yearn-finance/web-lib/components';
import {useSettings, useWeb3} from '@yearn-finance/web-lib/contexts';
import {defaultTxStatus, ETH_TOKEN_ADDRESS, format, isZeroAddress, performBatchedUpdates, providers, toAddress, Transaction, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Dropdown} from '@common/components/TokenDropdown';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import IconArrowRight from '@common/icons/IconArrowRight';
import {getCounterValue, handleInputChange} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {depositETH} from '@common/utils/actions/depositEth';
import {depositViaPartner} from '@common/utils/actions/depositViaPartner';
import {withdrawETH} from '@common/utils/actions/withdrawEth';
import {withdrawShare} from '@common/utils/actions/withdrawShare';
import {ZAP_ETH_WETH_CONTRACT} from '@common/utils/constants';

import type {BigNumber} from 'ethers';
import type {ChangeEvent, ReactElement} from 'react';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';


// eslint-disable-next-line @typescript-eslint/naming-convention
const		ARE_ZAP_ENABLED = false;

function	setZapOption(name: string, symbol: string, address: string, safeChainID: number): TDropdownOption {
	return ({
		label: name,
		symbol: symbol,
		value: address,
		icon: <ImageWithFallback
			src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${address}/logo-128.png`}
			alt={name}
			width={36}
			height={36} />
	});
}

function	ActionButton({
	isDepositing,
	currentVault,
	amount,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: {
	isDepositing: boolean,
	currentVault: TYearnVault,
	amount: TNormalizedBN;
	selectedOptionFrom?: TDropdownOption;
	selectedOptionTo?: TDropdownOption;
	onSuccess: VoidFunction;
}): ReactElement {
	const	{networks} = useSettings();
	const	{isActive, address, provider, safeChainID} = useWeb3();
	const	{currentPartner} = useYearn();
	const	[txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const	[txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);

	const	isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
	const	isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
	const	isPartnerAddressValid = useMemo((): boolean => !isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress)), [networks, safeChainID]);
	const	isUsingPartnerContract = useMemo((): boolean => ((process?.env?.SHOULD_USE_PARTNER_CONTRACT || true) === true && isPartnerAddressValid), [isPartnerAddressValid]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Perform a smartContract call to the deposit contract to get the allowance for the deposit
	** action. This is only refreshed if the amount typed in the input change to be bigger than the
	** current state allowance. Default state allowance is 0, so it will be refreshed on the first
	** render.
	**********************************************************************************************/
	const allowanceFetcher = useCallback(async (inputToken: string, outputToken: string): Promise<{raw: BigNumber, normalized: number}> => {
		const	currentProvider = provider || providers.getProvider(safeChainID);
		const	contract = new ethers.Contract(
			inputToken,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			currentProvider
		);

		let	spender = outputToken;
		if (isDepositing && isUsingPartnerContract) {
			spender = toAddress(networks?.[safeChainID]?.partnerContractAddress);
		}
		if (!isDepositing && isOutputTokenEth) {
			spender = ZAP_ETH_WETH_CONTRACT;
		}

		try {
			const	tokenAllowance = await contract.allowance(address, spender) || ethers.constants.Zero;
			const	effectiveAllowance = ({
				raw: tokenAllowance,
				normalized: format.toNormalizedValue(tokenAllowance || ethers.constants.Zero, currentVault?.decimals)
			});
			return effectiveAllowance;
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
	}, [address, currentVault?.decimals, isDepositing, isOutputTokenEth, isUsingPartnerContract, networks, provider, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: allowanceFrom, isValidating: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo && (
			(isDepositing && !isInputTokenEth) || (!isDepositing && isOutputTokenEth)
		) ? [selectedOptionFrom.value, selectedOptionTo.value] : null,
		allowanceFetcher,
		{revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return;
		}
		let spender = toAddress(selectedOptionTo.value);
		if ((process?.env?.SHOULD_USE_PARTNER_CONTRACT || true) === true) {
			spender = toAddress(networks[safeChainID].partnerContractAddress);
		}
		if (isZeroAddress(spender)) {
			spender = toAddress(selectedOptionTo.value);
		}

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			spender,
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** TODO
	**************************************************************************/
	async function	onApproveTo(): Promise<void> {
		if (!selectedOptionTo || !selectedOptionFrom) {
			return;
		}

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			ZAP_ETH_WETH_CONTRACT,
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	** the selected vault.
	**************************************************************************/
	async function	onDepositToVault(): Promise<void> {
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

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens
	** via the Partner Contract, to the selected vault.
	**************************************************************************/
	async function	onDepositViaPartner(): Promise<void> {
		new Transaction(provider, depositViaPartner, set_txStatusDeposit).populate(
			networks[safeChainID].partnerContractAddress,
			currentPartner,
			currentVault.address,
			amount.raw
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action using the ETH zap contract to deposit ETH
	** to the selected yvETH vault. The contract will first convert ETH to WETH,
	** aka the vault underlying token, and then deposit it to the vault.
	**************************************************************************/
	async function	onDepositEth(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, depositETH, set_txStatusDeposit).populate(
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the ETH zap contract to take back
	** some ETH from the selected yvETH vault. The contract will first convert
	** yvETH to wETH, unwrap the wETH and send them to the user.
	**************************************************************************/
	async function	onWithdrawEth(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, withdrawETH, set_txStatusDeposit).populate(
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the vault contract to take back
	** some underlying token from this specific vault.
	**************************************************************************/
	async function	onWithdrawShare(): Promise<void> {
		if (!selectedOptionFrom) {
			return;
		}
		new Transaction(provider, withdrawShare, set_txStatusDeposit).populate(
			toAddress(selectedOptionFrom.value), //vault address
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Wrapper to decide if we should use the partner contract or not
	**************************************************************************/
	async function	onDepositOrWithdraw(): Promise<void> {
		if (isDepositing) {
			if (isInputTokenEth) {
				await onDepositEth();
			} else if (isUsingPartnerContract) {
				await onDepositViaPartner();
			} else {
				await onDepositToVault();
			}
		} else {
			if (isOutputTokenEth) {
				await onWithdrawEth();
			} else {
				await onWithdrawShare();
			}
		}
	}

	if ((txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0)) && (
		(isDepositing && !isInputTokenEth) || (!isDepositing && isOutputTokenEth)
	)) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero()}
				onClick={isOutputTokenEth ? onApproveTo : onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	return (
		<Button
			onClick={onDepositOrWithdraw}
			className={'w-full'}
			isBusy={txStatusDeposit.pending}
			isDisabled={!isActive || amount.raw.isZero()}>
			{isDepositing ? 'Deposit' : 'Withdraw'}
		</Button>
	);

}

function	VaultDetailsQuickActions({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{isActive, provider, safeChainID} = useWeb3();
	const	{balances, refresh} = useWallet();
	const	{prices} = useYearn();

	const	[possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const	[possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);

	const	[selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	const	[selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	const	[amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});

	const	isDepositing = useMemo((): boolean => (
		!selectedOptionTo?.value ? true : toAddress(selectedOptionTo.value) === toAddress(currentVault.address)
	), [selectedOptionTo, currentVault]);

	/* 🔵 - Yearn Finance **************************************************************************
	** If the token to deposit is wETH, we can also deposit ETH via our custom Zap contract. In
	** order to be able to do that, we need to be able to select ETH or wETH as the token to, and
	** so, we need to create the "possibleOptionsFrom" array.
	**********************************************************************************************/
	useEffect((): void => {
		if (isDepositing) {
			if (currentVault && toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
				set_possibleOptionsFrom([
					setZapOption('ETH', 'ETH', ETH_TOKEN_ADDRESS, safeChainID),
					setZapOption('wETH', 'wETH', WETH_TOKEN_ADDRESS, safeChainID)
				]);
			} else {
				set_possibleOptionsFrom([
					setZapOption(
						currentVault?.token?.display_name || currentVault?.token?.name,
						currentVault?.token?.symbol,
						toAddress(currentVault.token.address),
						safeChainID
					)
				]);
			}
		}
	}, [currentVault, isDepositing, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Init selectedOptionFrom and selectedOptionTo with the tokens matching this vault. Only
	** triggered if the variables are undefined
	**********************************************************************************************/
	useEffect((): void => {
		if (currentVault && !selectedOptionFrom && !selectedOptionTo) {
			const	_selectedFrom = setZapOption(
				currentVault?.token?.display_name || currentVault?.token?.name,
				currentVault?.token?.symbol,
				toAddress(currentVault.token.address),
				safeChainID
			);
			const	_selectedTo = setZapOption(
				currentVault?.display_name || currentVault?.name || currentVault.formated_name,
				currentVault?.display_symbol || currentVault.symbol,
				toAddress(currentVault.address),
				safeChainID
			);
			performBatchedUpdates((): void => {
				set_selectedOptionFrom(_selectedFrom);
				set_selectedOptionTo(_selectedTo);
			});
		}
	}, [selectedOptionFrom, selectedOptionTo, currentVault, safeChainID]);

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
			isDepositing ? selectedOptionTo.value : selectedOptionFrom.value,
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = await contract.pricePerShare() || ethers.constants.Zero;
			if (isDepositing) {
				const	expectedOutFetched = _amountIn.mul(ethers.constants.WeiPerEther).div(pps);
				return ({
					raw: expectedOutFetched,
					normalized: format.toNormalizedValue(expectedOutFetched || ethers.constants.Zero, currentVault?.decimals)
				});
			} else {
				const	expectedOutFetched = _amountIn.mul(pps).div(ethers.constants.WeiPerEther);
				return ({
					raw: expectedOutFetched,
					normalized: format.toNormalizedValue(expectedOutFetched || ethers.constants.Zero, currentVault?.decimals)
				});
			}
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
		
	}, [selectedOptionFrom, selectedOptionTo, provider, safeChainID, currentVault?.decimals, isDepositing]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the expectedOutFetcher callback.
	**********************************************************************************************/
	const	{data: expectedOut} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo ? [
			selectedOptionFrom.value,
			selectedOptionTo.value,
			amount.raw
		] : null,
		expectedOutFetcher,
		{refreshInterval: 30000, shouldRetryOnError: false, revalidateOnFocus: false}
	);

	const	onSwitchFromTo = useCallback((): void => {
		performBatchedUpdates((): void => {
			const _selectedOptionTo = selectedOptionTo;
			const _possibleOptionsTo = possibleOptionsTo;
			set_selectedOptionTo(selectedOptionFrom);
			set_selectedOptionFrom(_selectedOptionTo);
			set_possibleOptionsTo(possibleOptionsFrom);
			set_possibleOptionsFrom(_possibleOptionsTo);
			if (isDepositing) {
				set_amount({raw: ethers.constants.Zero, normalized: 0});
			} else {
				set_amount({
					raw: balances?.[toAddress(_selectedOptionTo?.value)]?.raw || ethers.constants.Zero,
					normalized: balances?.[toAddress(_selectedOptionTo?.value)]?.normalized || 0
				});
			}
		});
	}, [possibleOptionsFrom, possibleOptionsTo, selectedOptionFrom, selectedOptionTo, isDepositing, balances]);

	return (
		<div
			aria-label={'Quick Deposit'}
			className={'col-span-12 mb-4 mt-10 flex flex-col space-x-0 space-y-2 bg-neutral-200 p-4 md:mt-20 md:flex-row md:space-x-4 md:space-y-0 md:p-8'}>

			<section aria-label={'FROM'} className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
				<div className={'relative z-10 w-full space-y-2'}>
					<div className={'flex flex-row items-baseline justify-between'}>
						<label className={'text-base text-neutral-600'}>
							{isDepositing ? 'From wallet' : 'From vault'}
						</label>
						<legend className={'inline text-xs tabular-nums text-neutral-600 md:hidden'} suppressHydrationWarning>
							{`You have ${format.amount(balances[selectedOptionFrom?.value || '']?.normalized || 0, 2, 2)} ${selectedOptionFrom?.symbol || 'tokens'}`}
						</legend>
					</div>
					{(ARE_ZAP_ENABLED || possibleOptionsFrom.length > 1) ? (
						<Dropdown
							defaultOption={possibleOptionsFrom[0]}
							options={possibleOptionsFrom}
							selected={selectedOptionFrom}
							balances={balances}
							onSelect={(option: TDropdownOption): void => set_selectedOptionFrom(option)} />
					) : (
						<div className={'flex h-10 w-full items-center justify-between bg-neutral-100 px-2 text-base text-neutral-900 md:px-3'}>
							<div className={'relative flex flex-row items-center'}>
								<div className={'h-6 w-6 rounded-full'}>
									{selectedOptionFrom?.icon}
								</div>
								<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
									{selectedOptionFrom?.symbol}
								</p>
							</div>
						</div>
					)}
					<legend className={'hidden text-xs tabular-nums text-neutral-600 md:inline'} suppressHydrationWarning>
						{`You have ${format.amount(balances[selectedOptionFrom?.value || '']?.normalized || 0, 2, 2)} ${selectedOptionFrom?.symbol || 'tokens'}`}
					</legend>
				</div>
				<div className={'w-full space-y-2'}>
					<label className={'hidden text-base text-neutral-600 md:inline'}>{'Amount'}</label>
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
					<legend className={'mr-1 text-end text-xs tabular-nums text-neutral-600 md:mr-0 md:text-start'}>
						{getCounterValue(amount?.normalized || 0, selectedOptionFromPricePerToken)}
					</legend>
				</div>
			</section>

			<div className={'mx-auto flex w-full justify-center space-y-0 md:mx-none md:block md:w-14 md:space-y-2'}>
				<label className={'hidden text-base md:inline'}>&nbsp;</label>
				<Button onClick={onSwitchFromTo} className={'flex h-6 w-6 rotate-90 items-center justify-center bg-neutral-900 p-0 md:h-10 md:w-14 md:rotate-0'}>
					<IconArrowRight className={'w-4 text-neutral-0 md:w-[25px]'} />
				</Button>
				<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
			</div>

			<section aria-label={'TO'} className={'flex w-full flex-col space-x-0 md:flex-row md:space-x-4'}>
				<div className={'relative z-10 w-full space-y-2'}>
					<div className={'flex flex-row items-baseline justify-between'}>
						<label className={'text-base text-neutral-600'}>
							{isDepositing ? 'To vault' : 'To wallet'}
						</label>
						<legend className={'inline text-xs tabular-nums text-neutral-600 md:hidden'} suppressHydrationWarning>
							{`APY ${isDepositing ? format.amount((currentVault?.apy?.net_apy || 0) * 100, 2, 2) : '0.00'} %`}
						</legend>
					</div>
					{(ARE_ZAP_ENABLED || possibleOptionsTo.length > 1) ? (
						<Dropdown
							defaultOption={possibleOptionsTo[0]}
							options={possibleOptionsTo}
							selected={selectedOptionTo}
							onSelect={(option: TDropdownOption): void => set_selectedOptionTo(option)} />
					) : (
						<div className={'flex h-10 w-full items-center justify-between bg-neutral-100 px-2 text-base text-neutral-900 md:px-3'}>
							<div className={'relative flex flex-row items-center'}>
								<div className={'h-6 w-6 rounded-full'}>
									{selectedOptionTo?.icon}
								</div>
								<p className={'overflow-x-hidden text-ellipsis whitespace-nowrap pl-2 font-normal text-neutral-900 scrollbar-none'}>
									{selectedOptionTo?.symbol}
								</p>
							</div>
						</div>
					)}
					<legend className={'hidden text-xs tabular-nums text-neutral-600 md:inline'} suppressHydrationWarning>
						{isDepositing ? `APY ${format.amount((currentVault?.apy?.net_apy || 0) * 100, 2, 2)} %` : ''}
					</legend>
				</div>

				<div className={'w-full space-y-2'}>
					<label className={'hidden text-base text-neutral-600 md:inline'}>
						{'You will receive'}
					</label>
					<div className={'flex h-10 items-center bg-neutral-300 p-2'}>
						<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
							<input
								className={'w-full cursor-default overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none'}
								type={'text'}
								disabled
								value={expectedOut?.normalized || 0} />
						</div>
					</div>
					<legend className={'mr-1 text-end text-xs tabular-nums text-neutral-600 md:mr-0 md:text-start'}>
						{getCounterValue(expectedOut?.normalized || 0, selectedOptionToPricePerToken)}
					</legend>
				</div>
			</section>

			<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
				<label className={'hidden text-base md:inline'}>&nbsp;</label>
				<div>
					<ActionButton
						isDepositing={isDepositing}
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
				<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
			</div>
		</div>
	);
}

export {VaultDetailsQuickActions};