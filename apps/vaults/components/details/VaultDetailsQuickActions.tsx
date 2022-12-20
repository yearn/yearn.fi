import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {ethers} from 'ethers';
import useCowswap from '@vaults/contexts/useSolverCowswap';
import {setZapOption} from '@vaults/utils/zapOptions';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import useWeb3 from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBigNumberAsAmount, formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useWallet} from '@common/contexts/useWallet';

import VaultDetailsQuickActionsButtons from './details/actions/QuickActionsButtons';
import VaultDetailsQuickActionsFrom from './details/actions/QuickActionsFrom';
import VaultDetailsQuickActionsSwitch from './details/actions/QuickActionsSwitch';
import VaultDetailsQuickActionsTo from './details/actions/QuickActionsTo';

import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

export enum	Solvers {
	VANILLA = 'vanilla',
	PARTNER_CONTRACT = 'partnerContract',
	CHAIN_COIN = 'chainCoin',
	COWSWAP = 'cowswap',
	WIDO = 'wido',
	PORTALS = 'portals'
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const	DEBUG_WITH_COWSWAP = true;

type	TQuickActionContext = {
	currentVault: TYearnVault;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
	selectedOptionFrom: TDropdownOption | undefined;
	selectedOptionTo: TDropdownOption | undefined;
	amount: TNormalizedBN;
	onChangeAmount: (amount: TNormalizedBN) => void;
	onUpdateSelectedOptionFrom: (option: TDropdownOption) => void;
	onUpdateSelectedOptionTo: (option: TDropdownOption) => void;
	onSwitchSelectedOptions: () => void;
	isDepositing: boolean;
	isLoadingExpectedOut: boolean;
	maxDepositPossible: TNormalizedBN;
	expectedOut: TNormalizedBN;
	currentSolver: Solvers;
}
const	DefaultQuickActionContext: TQuickActionContext = {
	currentVault: {} as TYearnVault, // eslint-disable-line @typescript-eslint/consistent-type-assertions
	possibleOptionsFrom: [],
	possibleOptionsTo: [],
	selectedOptionFrom: undefined,
	selectedOptionTo: undefined,
	amount: {raw: ethers.constants.Zero, normalized: 0},
	onChangeAmount: (): void => undefined,
	onUpdateSelectedOptionFrom: (): void => undefined,
	onUpdateSelectedOptionTo: (): void => undefined,
	onSwitchSelectedOptions: (): void => undefined,
	isDepositing: true,
	isLoadingExpectedOut: false,
	maxDepositPossible: {raw: ethers.constants.Zero, normalized: 0},
	expectedOut: {raw: ethers.constants.Zero, normalized: 0},
	currentSolver: Solvers.VANILLA
};
const	QuickActionContext = createContext<TQuickActionContext>(DefaultQuickActionContext);
export const QuickActionContextComponent = ({currentVault}: {currentVault: TYearnVault}): React.ReactElement => {
	const {address} = useWeb3();
	const {balances} = useWallet();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();

	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	const [selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	const [selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	const [amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});

	const	{quote, initCowswap} = useCowswap();


	const isDepositing = useMemo((): boolean => (
		!selectedOptionTo?.value ? true : toAddress(selectedOptionTo.value) === toAddress(currentVault.address)
	), [selectedOptionTo, currentVault]);

	const isPartnerAddressValid = useMemo((): boolean => (
		!isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress))
	), [networks, safeChainID]);

	const isUsingPartnerContract = useMemo((): boolean => (
		(process?.env?.SHOULD_USE_PARTNER_CONTRACT || true) === true && isPartnerAddressValid
	), [isPartnerAddressValid]);

	const maxDepositPossible = useMemo((): TNormalizedBN => {
		const	vaultDepositLimit = formatBN(currentVault.details.depositLimit) || ethers.constants.Zero;
		const	userBalance = balances?.[toAddress(selectedOptionFrom?.value)]?.raw || ethers.constants.Zero;
		if (userBalance.gt(vaultDepositLimit)) {
			return ({
				raw: vaultDepositLimit,
				normalized: formatToNormalizedValue(vaultDepositLimit, currentVault.token.decimals)
			});
		} else {
			return ({
				raw: userBalance,
				normalized: balances?.[toAddress(selectedOptionFrom?.value)]?.normalized || 0
			});
		}
	}, [balances, currentVault.details.depositLimit, currentVault.token.decimals, selectedOptionFrom?.value]);

	const currentSolver = useMemo((): Solvers => {
		if (DEBUG_WITH_COWSWAP) {
			initCowswap({
				from: toAddress(address || ''),
				sellToken: toAddress(selectedOptionFrom?.value),
				buyToken: toAddress(selectedOptionTo?.value),
				sellAmount: amount.raw,
				buyTokenDecimals: Number(selectedOptionTo?.decimals || 18),
				sellTokenDecimals: Number(selectedOptionFrom?.decimals || 18)
			});
			return Solvers.COWSWAP;
		}

		const isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
		const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
		if (isInputTokenEth || isOutputTokenEth) {
			return Solvers.CHAIN_COIN;
		} else if (isDepositing && isUsingPartnerContract) {
			return Solvers.PARTNER_CONTRACT;
		} 
		return Solvers.VANILLA;
	}, [address, amount.raw, initCowswap, isDepositing, isUsingPartnerContract, selectedOptionFrom?.decimals, selectedOptionFrom?.value, selectedOptionTo?.decimals, selectedOptionTo?.value]);


	const onSwitchSelectedOptions = useCallback((): void => {
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
	
	const expectedOut = useMemo((): TNormalizedBN => {
		console.warn({amount: quote?.result?.quote?.buyAmount});
		if (!selectedOptionTo || !selectedOptionFrom || !amount.raw) {
			return {raw: ethers.constants.Zero, normalized: 0};
		}
		if (DEBUG_WITH_COWSWAP) {
			return ({
				raw: formatBN(quote?.result?.quote?.buyAmount || ethers.constants.Zero),
				normalized: formatBigNumberAsAmount(formatBN(quote?.result?.quote?.buyAmount || 0), selectedOptionTo?.decimals)
			});
		}
		return {raw: ethers.constants.Zero, normalized: 0};
	}, [amount.raw, quote?.result?.quote?.buyAmount, selectedOptionFrom, selectedOptionTo]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TQuickActionContext => ({
		currentVault,
		possibleOptionsFrom,
		possibleOptionsTo,
		selectedOptionFrom,
		selectedOptionTo,
		amount,
		onChangeAmount: set_amount,
		onUpdateSelectedOptionFrom: set_selectedOptionFrom,
		onUpdateSelectedOptionTo: set_selectedOptionTo,
		onSwitchSelectedOptions: onSwitchSelectedOptions,
		isDepositing,
		isLoadingExpectedOut: quote?.isLoading || false,
		maxDepositPossible,
		expectedOut,
		currentSolver
	}), [currentVault, possibleOptionsFrom, possibleOptionsTo, selectedOptionFrom, selectedOptionTo, amount, onSwitchSelectedOptions, isDepositing, maxDepositPossible, expectedOut, currentSolver, quote?.isLoading]);

	return (
		<QuickActionContext.Provider value={contextValue}>
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
				<VaultDetailsQuickActionsFrom />
				<VaultDetailsQuickActionsSwitch />
				<VaultDetailsQuickActionsTo />
				<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
					<label className={'hidden text-base md:inline'}>&nbsp;</label>
					<div>
						<VaultDetailsQuickActionsButtons />
					</div>
					<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
				</div>
			</div>
		</QuickActionContext.Provider>
	);
};
export const useQuickAction = (): TQuickActionContext => useContext(QuickActionContext);

<<<<<<< HEAD
export {VaultDetailsQuickActions};
=======
export default QuickActionContextComponent;
>>>>>>> 0aae23c (feat: reorder files)
