import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {QuickActionFromBox} from '@vaults/components/actions/QuickActionFromBox';
import {QuickActionSwitch} from '@vaults/components/actions/QuickActionSwitch';
import {QuickActionToBox} from '@vaults/components/actions/QuickActionToBox';
import {getEthZapperContract} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {depositETH} from '@common/utils/actions/depositEth';
import {depositViaPartner} from '@common/utils/actions/depositViaPartner';
import {withdrawETH} from '@common/utils/actions/withdrawEth';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

type TSetZapOptionProps = {
	address: TAddress;
	name: string;
	symbol: string;
	safeChainID: number;
	decimals: number;
	rest?: { [key: string]: unknown };
}

function	setZapOption({name, symbol, address, safeChainID, decimals, rest}: TSetZapOptionProps): TDropdownOption {
	return ({
		label: name,
		symbol,
		value: address,
		decimals,
		icon: <ImageWithFallback
			src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${address}/logo-128.png`}
			alt={name}
			width={36}
			height={36} />,
		...rest
	});
}

function	ActionButton({
	isDepositing,
	currentVault,
	amount,
	max,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: {
	isDepositing: boolean,
	currentVault: TYearnVault,
	amount: TNormalizedBN;
	max: TNormalizedBN;
	selectedOptionFrom?: TDropdownOption;
	selectedOptionTo?: TDropdownOption;
	onSuccess: VoidFunction;
}): ReactElement {
	const {networks} = useSettings();
	const {isActive, address, provider} = useWeb3();
	const {chainID, safeChainID} = useChainID();
	const {currentPartner} = useYearn();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);

	const isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
	const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
	const isPartnerAddressValid = useMemo((): boolean => !isZeroAddress(toAddress(networks[safeChainID]?.partnerContractAddress)), [networks, safeChainID]);
	const isUsingPartnerContract = useMemo((): boolean => ((process?.env?.SHOULD_USE_PARTNER_CONTRACT || true) === true && isPartnerAddressValid), [isPartnerAddressValid]);

	/* 🔵 - Yearn Finance **************************************************************************
	** This memo will be used to determine the spender address for the transactions based on the
	** from and to options selected:
	** - By default, the spender is the vault itself, aka a direct deposit
	** - If we are depositing and using the partner contract, spender is the partner contract
	** - If we are not depositing and we want to withdraw eth, spender is the eth zapper contract	
	**********************************************************************************************/
	const spender = useMemo((): TAddress => {
		let	spender = toAddress(selectedOptionTo?.value || ethers.constants.AddressZero);
		if (isDepositing && isUsingPartnerContract) { 
			spender = toAddress(networks[safeChainID]?.partnerContractAddress);
		} else if (!isDepositing && isOutputTokenEth) {
			spender = toAddress(getEthZapperContract(chainID));
		}
		return spender;
	}, [chainID, isDepositing, isOutputTokenEth, isUsingPartnerContract, networks, safeChainID, selectedOptionTo?.value]);	

	/* 🔵 - Yearn Finance **************************************************************************
	** Perform a smartContract call to the deposit contract to get the allowance for the deposit
	** action. This is only refreshed if the amount typed in the input change to be bigger than the
	** current state allowance. Default state allowance is 0, so it will be refreshed on the first
	** render.
	**********************************************************************************************/
	const allowanceFetcher = useCallback(async (args: [string, string]): Promise<{raw: BigNumber, normalized: number}> => {
		const	[inputToken, spenderContract] = args;
		const	currentProvider = provider || getProvider(safeChainID);
		const	contract = new ethers.Contract(
			inputToken,
			['function allowance(address _owner, address _spender) public view returns (uint256)'],
			currentProvider
		);

		try {
			const	tokenAllowance = await contract.allowance(address, spenderContract) || ethers.constants.Zero;
			const	effectiveAllowance = ({
				raw: tokenAllowance,
				normalized: formatToNormalizedValue(tokenAllowance || ethers.constants.Zero, currentVault?.decimals)
			});
			return effectiveAllowance;
		} catch (error) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
	}, [address, currentVault?.decimals, provider, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: allowanceFrom, isLoading: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo && (
			(isDepositing && !isInputTokenEth) || (!isDepositing && isOutputTokenEth)
		) ? [selectedOptionFrom.value, spender] : null,
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

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			spender,
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** When we want to withdraw a yvWrappedCoin to the base chain coin, we first
	** need to approve the yvWrappedCoin to be used by the zap contract.
	**************************************************************************/
	async function	onApproveTo(): Promise<void> {
		if (!selectedOptionTo || !selectedOptionFrom) {
			return;
		}

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			getEthZapperContract(chainID),
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
			safeChainID,
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
			chainID,
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the vault contract to take back
	** some underlying token from this specific vault.
	**************************************************************************/
	async function	onWithdrawShares(): Promise<void> {
		if (!selectedOptionFrom) {
			return;
		}
		new Transaction(provider, withdrawShares, set_txStatusDeposit).populate(
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
				await onWithdrawShares();
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
				isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(max.raw)}
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
			isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(max.raw)}>
			{isDepositing ? 'Deposit' : 'Withdraw'}
		</Button>
	);

}

function	VaultDetailsQuickActions({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {isActive, provider} = useWeb3();
	const {chainID, safeChainID} = useChainID();
	const {balances, refresh} = useWallet();
	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	const [selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	const [selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	const [amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});

	const maxDepositPossible = useMemo((): TNormalizedBN => {
		const	vaultDepositLimit = formatBN(currentVault.details.depositLimit) || ethers.constants.Zero;
		const	userBalance = balances?.[toAddress(selectedOptionFrom?.value)]?.raw || ethers.constants.Zero;
		if (userBalance.gt(vaultDepositLimit)) {
			return ({
				raw: vaultDepositLimit,
				normalized: formatToNormalizedValue(vaultDepositLimit, currentVault.token.decimals)
			});
		} 
		return ({
			raw: userBalance,
			normalized: balances?.[toAddress(selectedOptionFrom?.value)]?.normalized || 0
		});
		
	}, [balances, currentVault.details.depositLimit, currentVault.token.decimals, selectedOptionFrom?.value]);

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
			if (safeChainID === 1 && currentVault && toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
				set_possibleOptionsFrom([
					setZapOption({name: 'ETH', symbol: 'ETH', address: ETH_TOKEN_ADDRESS, safeChainID, decimals: 18}),
					setZapOption({name: 'wETH', symbol: 'wETH', address: WETH_TOKEN_ADDRESS, safeChainID, decimals: 18})
				]);
			} else if (safeChainID === 250 && currentVault && toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
				set_possibleOptionsFrom([
					setZapOption({name: 'FTM', symbol: 'FTM', address: ETH_TOKEN_ADDRESS, safeChainID, decimals: 18}),
					setZapOption({name: 'wFTM', symbol: 'wFTM', address: WFTM_TOKEN_ADDRESS, safeChainID, decimals: 18})
				]);
			} else {
				set_possibleOptionsFrom([
					setZapOption({
						name: currentVault?.token?.display_name || currentVault?.token?.name,
						symbol: currentVault?.token?.symbol,
						address: toAddress(currentVault.token.address),
						safeChainID,
						decimals: currentVault.decimals
					})
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
			const	_selectedFrom = setZapOption({
				name: currentVault?.token?.display_name || currentVault?.token?.name,
				symbol: currentVault?.token?.symbol,
				address: toAddress(currentVault.token.address),
				safeChainID,
				decimals: currentVault?.decimals || 18
			});
			const	_selectedTo = setZapOption({
				name: currentVault?.display_name || currentVault?.name || currentVault.formated_name,
				symbol: currentVault?.display_symbol || currentVault.symbol,
				address: toAddress(currentVault.address),
				safeChainID,
				decimals: currentVault?.token?.decimals || 18
			});
			performBatchedUpdates((): void => {
				set_selectedOptionFrom(_selectedFrom);
				set_selectedOptionTo(_selectedTo);
			});
		}
	}, [selectedOptionFrom, selectedOptionTo, currentVault, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Perform a smartContract call to the deposit contract to get the expected out for a given
	** in/out pair with a specific amount. This callback is called every 10s or when amount/in or
	** out changes.
	**********************************************************************************************/
	const expectedOutFetcher = useCallback(async (args: [TDropdownOption, TDropdownOption, BigNumber]): Promise<TNormalizedBN> => {
		const [_inputToken, _outputToken, _amountIn] = args;
		if (!_inputToken || !_outputToken) {
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
		
		const	currentProvider = provider || getProvider(chainID);
		const	contract = new ethers.Contract(
			toAddress(isDepositing ? _outputToken.value : _inputToken.value),
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = await contract.pricePerShare() || ethers.constants.Zero;
			if (isDepositing) {
				const	expectedOutFetched = _amountIn.mul(formatBN(10).pow(_outputToken?.decimals)).div(pps);
				return ({
					raw: expectedOutFetched,
					normalized: formatToNormalizedValue(expectedOutFetched || ethers.constants.Zero, _outputToken?.decimals || currentVault?.decimals)
				});
			} 
			const	expectedOutFetched = _amountIn.mul(pps).div(formatBN(10).pow(_outputToken?.decimals));
			return ({
				raw: expectedOutFetched,
				normalized: formatToNormalizedValue(expectedOutFetched || ethers.constants.Zero, _outputToken?.decimals || currentVault?.decimals)
			});
			
		} catch (error) {
			console.error(error);
			return ({raw: ethers.constants.Zero, normalized: 0});
		}
		
	}, [provider, chainID, currentVault?.decimals, isDepositing]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the expectedOutFetcher callback.
	**********************************************************************************************/
	const	{data: expectedOut} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo ? [
			selectedOptionFrom,
			selectedOptionTo,
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
				set_amount(maxDepositPossible);
			}
		});
	}, [selectedOptionTo, possibleOptionsTo, selectedOptionFrom, possibleOptionsFrom, isDepositing, maxDepositPossible]);

	return (
		<>
			<nav className={'mt-10 mb-2 w-full md:mt-20'}>
				<Link href={'/vaults'}>
					<p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>
						{'Back to vaults'}
					</p>
				</Link>
			</nav>
			<div
				aria-label={'Quick Deposit'}
				className={'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-200 p-4 md:flex-row md:space-x-4 md:space-y-0 md:p-8'}>

				<QuickActionFromBox
					isDepositing={isDepositing}
					amount={amount}
					selectedOptionFrom={selectedOptionFrom}
					possibleOptionsFrom={possibleOptionsFrom}
					onSelectFrom={set_selectedOptionFrom}
					onSetAmount={set_amount}
					onSetMaxAmount={(): void => set_amount(maxDepositPossible)} />

				<QuickActionSwitch onSwitchFromTo={onSwitchFromTo} />

				<QuickActionToBox
					currentVault={currentVault}
					isDepositing={isDepositing}
					expectedOut={expectedOut}
					selectedOptionTo={selectedOptionTo}
					possibleOptionsTo={possibleOptionsTo}
					onSelectTo={set_selectedOptionTo} />

				<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
					<label className={'hidden text-base md:inline'}>&nbsp;</label>
					<div>
						<ActionButton
							isDepositing={isDepositing}
							currentVault={currentVault}
							amount={amount}
							max={maxDepositPossible}
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
		</>
	);
}

export {VaultDetailsQuickActions};
