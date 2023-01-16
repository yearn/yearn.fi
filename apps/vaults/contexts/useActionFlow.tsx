import React, {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react';
import {ethers} from 'ethers';
import {Solver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {setZapOption} from '@vaults/utils/zapOptions';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactNode} from 'react';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

type TActionParams = {
	amount: TNormalizedBN;
	selectedOptionFrom: TDropdownOption | undefined;
	selectedOptionTo: TDropdownOption | undefined;
}
type	TActionFlowContext = {
	currentVault: TYearnVault;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
	// selectedOptionFrom: TDropdownOption | undefined;
	// selectedOptionTo: TDropdownOption | undefined;
	// amount: TNormalizedBN;
	actionParams: TActionParams;
	onChangeAmount: (amount: TNormalizedBN) => void;
	onUpdateSelectedOptionFrom: (option: TDropdownOption) => void;
	onUpdateSelectedOptionTo: (option: TDropdownOption) => void;
	onSwitchSelectedOptions: () => void;
	isDepositing: boolean;
	maxDepositPossible: TNormalizedBN;
	currentSolver: Solver;
}
const	DefaultActionFlowContext: TActionFlowContext = {
	currentVault: {} as TYearnVault, // eslint-disable-line @typescript-eslint/consistent-type-assertions
	possibleOptionsFrom: [],
	possibleOptionsTo: [],
	// selectedOptionFrom: undefined,
	// selectedOptionTo: undefined,
	// amount: toNormalizedBN(0),
	actionParams: {
		amount: toNormalizedBN(0),
		selectedOptionFrom: undefined,
		selectedOptionTo: undefined
	},
	onChangeAmount: (): void => undefined,
	onUpdateSelectedOptionFrom: (): void => undefined,
	onUpdateSelectedOptionTo: (): void => undefined,
	onSwitchSelectedOptions: (): void => undefined,
	isDepositing: true,
	maxDepositPossible: toNormalizedBN(0),
	currentSolver: Solver?.VANILLA || 'Vanilla'
};

const ActionFlowContext = createContext<TActionFlowContext>(DefaultActionFlowContext);
function ActionFlowContextApp({children, currentVault}: {children: ReactNode, currentVault: TYearnVault}): React.ReactElement {
	const {balances} = useWallet();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();
	const {balances: zapBalances, tokensList, balancesNonce: zapBalancesNonce} = useWalletForZap();
	const {zapProvider} = useYearn();

	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsFrom, set_possibleZapOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	// const [selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	// const [selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	// const [amount, set_amount] = useState<TNormalizedBN>(toNormalizedBN(0));

	//Combine selectedOptionFrom, selectedOptionTo and amount in a useReducer
	const [actionParams, actionParamsDispatcher] = useReducer((
		state: TActionParams,
		action: {type: string, payload: Partial<TActionParams>}
	): TActionParams => {
		switch (action.type) {
			case 'selectedOptionFrom':
				return {...state, selectedOptionFrom: action.payload.selectedOptionFrom};
			case 'selectedOptionTo':
				return {...state, selectedOptionTo: action.payload.selectedOptionTo};
			case 'amount':
				return {...state, amount: action.payload.amount || toNormalizedBN(0)};
			case 'selectedOptions':
				return {
					...state,
					selectedOptionFrom: action.payload.selectedOptionFrom,
					selectedOptionTo: action.payload.selectedOptionTo
				};
			case 'all':
				return {
					selectedOptionFrom: action.payload.selectedOptionFrom,
					selectedOptionTo: action.payload.selectedOptionTo,
					amount: action.payload.amount || toNormalizedBN(0)
				};
			default:
				return state;
		}
	}, {
		selectedOptionFrom: undefined,
		selectedOptionTo: undefined,
		amount: toNormalizedBN(0)
	});


	const isDepositing = useMemo((): boolean => (
		!actionParams?.selectedOptionTo?.value || toAddress(actionParams?.selectedOptionTo.value) === toAddress(currentVault.address)
	), [actionParams?.selectedOptionTo?.value, currentVault.address]);

	const isPartnerAddressValid = useMemo((): boolean => (
		!isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress))
	), [networks, safeChainID]);

	const isUsingPartnerContract = useMemo((): boolean => (
		(process?.env?.SHOULD_USE_PARTNER_CONTRACT === undefined ? true : Boolean(process?.env?.SHOULD_USE_PARTNER_CONTRACT)) && isPartnerAddressValid
	), [isPartnerAddressValid]);

	const maxDepositPossible = useMemo((): TNormalizedBN => {
		const	vaultDepositLimit = formatBN(currentVault.details.depositLimit) || ethers.constants.Zero;
		const	userBalance = balances?.[toAddress(actionParams?.selectedOptionFrom?.value)]?.raw || ethers.constants.Zero;
		if (actionParams?.selectedOptionFrom?.value === currentVault?.token?.address && isDepositing) {
			if (userBalance.gt(vaultDepositLimit)) {
				return (toNormalizedBN(vaultDepositLimit, currentVault.token.decimals));
			}
		}

		return (toNormalizedBN(userBalance, actionParams?.selectedOptionFrom?.decimals || currentVault?.token?.decimals || 18));
	}, [actionParams?.selectedOptionFrom?.decimals, actionParams?.selectedOptionFrom?.value, balances, currentVault.details.depositLimit, currentVault.token?.address, currentVault.token.decimals, isDepositing]);

	const currentSolver = useMemo((): Solver => {
		const isInputTokenEth = actionParams?.selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
		const isOutputTokenEth = actionParams?.selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
		if (isInputTokenEth || isOutputTokenEth) {
			return Solver.CHAIN_COIN;
		}
		if (actionParams?.selectedOptionFrom?.solveVia?.includes(zapProvider)) {
			return zapProvider;
		}
		if (isDepositing && isUsingPartnerContract) {
			return Solver.PARTNER_CONTRACT;
		}
		return Solver.VANILLA;
	}, [isDepositing, isUsingPartnerContract, actionParams?.selectedOptionFrom?.solveVia, actionParams?.selectedOptionFrom?.value, actionParams?.selectedOptionTo?.value, zapProvider]);

	const onSwitchSelectedOptions = useCallback((): void => {
		performBatchedUpdates((): void => {
			const _selectedOptionTo = actionParams?.selectedOptionTo;
			const _possibleOptionsTo = possibleOptionsTo;
			let _selectedOptionFrom = actionParams?.selectedOptionFrom;
			if (isDepositing && (actionParams?.selectedOptionFrom?.solveVia || []).length > 0) {
				// We don't want to be able to withdraw to exotic tokens. If the current from is one of them, take another one.
				_selectedOptionFrom = possibleOptionsFrom.find((option: TDropdownOption): boolean => (
					option.value !== actionParams?.selectedOptionFrom?.value && (option.solveVia || []).length === 0
				));
			}
			actionParamsDispatcher({
				type: 'all',
				payload: {
					selectedOptionFrom: _selectedOptionTo,
					selectedOptionTo: _selectedOptionFrom,
					amount: isDepositing ? toNormalizedBN(0) : maxDepositPossible
				}
			});
			set_possibleOptionsTo(possibleOptionsFrom);
			set_possibleOptionsFrom(_possibleOptionsTo);
		});
	}, [actionParams?.selectedOptionTo, possibleOptionsTo, actionParams?.selectedOptionFrom, possibleOptionsFrom, isDepositing, maxDepositPossible]);

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
						decimals: currentVault?.token?.decimals || 18
					})
				]);
			}
		}
	}, [currentVault, isDepositing, safeChainID]);

	useEffect((): void => {
		const	_possibleZapOptionsFrom: TDropdownOption[] = [];
		const	isWithWETH = safeChainID === 1 && currentVault && toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS;
		const	isWithWFTM = safeChainID === 250 && currentVault && toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS;
		Object.entries(zapBalances || {}).forEach(([tokenAddress]): void => {
			const	tokenListData = tokensList[toAddress(tokenAddress)];
			if (isWithWETH && toAddress(tokenListData?.address) === WETH_TOKEN_ADDRESS) {
				// Do nothing to avoid duplicate wETH in the list
			} else if (isWithWFTM && toAddress(tokenListData?.address) === WFTM_TOKEN_ADDRESS) {
				// Do nothing to avoid duplicate wFTM in the list
			} else if (toAddress(tokenListData?.address) === currentVault?.token?.address) {
				// Do nothing to avoid duplicate vault underlying token in the list
			} else if (toAddress(tokenListData?.address) === currentVault?.address) {
				// Do nothing to avoid vault token in the list
			} else {
				_possibleZapOptionsFrom.push(
					setZapOption({
						name: tokenListData?.name,
						symbol: tokenListData?.symbol,
						address: toAddress(tokenListData?.address),
						safeChainID,
						decimals: tokenListData?.decimals,
						solveVia: tokenListData?.supportedZaps || []
					})
				);
			}
		});
		set_possibleZapOptionsFrom(_possibleZapOptionsFrom);
	}, [safeChainID, tokensList, zapBalances, zapBalancesNonce, currentVault]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Init selectedOptionFrom and selectedOptionTo with the tokens matching this vault. Only
	** triggered if the variables are undefined
	**********************************************************************************************/
	useEffect((): void => {
		if (currentVault && !actionParams?.selectedOptionFrom && !actionParams?.selectedOptionTo) {
			const	_selectedFrom = setZapOption({
				name: currentVault?.token?.display_name || currentVault?.token?.name,
				symbol: currentVault?.token?.symbol,
				address: toAddress(currentVault.token.address),
				safeChainID,
				decimals: currentVault?.token?.decimals || 18
			});
			const	_selectedTo = setZapOption({
				name: currentVault?.display_name || currentVault?.name || currentVault.formated_name,
				symbol: currentVault?.display_symbol || currentVault.symbol,
				address: toAddress(currentVault.address),
				safeChainID,
				decimals: currentVault?.decimals || 18
			});

			actionParamsDispatcher({
				type: 'selectedOptions',
				payload: {
					selectedOptionFrom: _selectedFrom,
					selectedOptionTo: _selectedTo
				}
			});
		}
	}, [actionParams?.selectedOptionFrom, actionParams?.selectedOptionTo, currentVault, safeChainID, isDepositing, balances]);

	/* 🔵 - Yearn Finance **************************************************************************
	** When the selectedOptionFrom change, we can also update the amount to the max possible value
	** but only if the user is depositing. Otherwise, we set the amount to 0.
	**********************************************************************************************/
	useEffect((): void => {
		if (currentVault && actionParams?.selectedOptionFrom) {
			actionParamsDispatcher({
				type: 'amount',
				payload: {
					amount: isDepositing ? maxDepositPossible : toNormalizedBN(0)
				}
			});
		}
	}, [currentVault, isDepositing, maxDepositPossible, actionParams?.selectedOptionFrom]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TActionFlowContext => ({
		currentVault,
		possibleOptionsFrom: [...possibleOptionsFrom, ...possibleZapOptionsFrom],
		possibleOptionsTo,
		actionParams,
		// selectedOptionFrom: actionParams?.selectedOptionFrom,
		// selectedOptionTo: actionParams?.selectedOptionTo,
		// amount: actionParams?.amount,
		onChangeAmount: (newAmount: TNormalizedBN): void => {
			actionParamsDispatcher({
				type: 'amount',
				payload: {amount: newAmount}
			});
		},
		onUpdateSelectedOptionFrom: (newSelectedOptionFrom: TDropdownOption): void => {
			actionParamsDispatcher({
				type: 'selectedOptionFrom',
				payload: {selectedOptionFrom: newSelectedOptionFrom}
			});
		},
		onUpdateSelectedOptionTo: (newSelectedOptionTo: TDropdownOption): void => {
			actionParamsDispatcher({
				type: 'selectedOptionTo',
				payload: {selectedOptionTo: newSelectedOptionTo}
			});
		},
		onSwitchSelectedOptions: onSwitchSelectedOptions,
		isDepositing,
		maxDepositPossible,
		currentSolver
	}), [currentVault, possibleOptionsFrom, possibleOptionsTo, actionParams, onSwitchSelectedOptions, isDepositing, maxDepositPossible, currentSolver, possibleZapOptionsFrom]);

	return (
		<ActionFlowContext.Provider value={contextValue}>
			{children}
		</ActionFlowContext.Provider>
	);
}

export const useActionFlow = (): TActionFlowContext => useContext(ActionFlowContext);
export default ActionFlowContextApp;
