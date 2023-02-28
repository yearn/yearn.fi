import React, {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react';
import {useMountEffect, useUpdateEffect} from '@react-hookz/web';
import {isSolverDisabled, Solver} from '@vaults/contexts/useSolver';
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

import externalzapOutTokenList from '../../common/utils/externalZapOutTokenList.json';

import type {BigNumber} from 'ethers';
import type {ReactNode} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

export enum	Flow {
	Deposit = 'deposit',
	Withdraw = 'withdraw',
	Migrate = 'migrate',
	Zap = 'zap', // TODO: create this flow handler
	Switch = 'switch'
}

type TActionParams = {
	isReady: boolean;
	amount: TNormalizedBN;
	selectedOptionFrom: TDropdownOption | undefined;
	selectedOptionTo: TDropdownOption | undefined;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
}
type	TActionFlowContext = {
	currentVault: TYearnVault;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
	actionParams: TActionParams;
	onChangeAmount: (amount: TNormalizedBN) => void;
	onUpdateSelectedOptionFrom: (option: TDropdownOption) => void;
	onUpdateSelectedOptionTo: (option: TDropdownOption) => void;
	onSwitchSelectedOptions: (nextFlow?: Flow) => void;
	isDepositing: boolean;
	maxDepositPossible: TNormalizedBN;
	currentSolver: Solver;
}
const	DefaultActionFlowContext: TActionFlowContext = {
	currentVault: {} as TYearnVault, // eslint-disable-line @typescript-eslint/consistent-type-assertions
	possibleOptionsFrom: [],
	possibleOptionsTo: [],
	actionParams: {
		isReady: false,
		amount: toNormalizedBN(0),
		selectedOptionFrom: undefined,
		selectedOptionTo: undefined,
		possibleOptionsFrom: [],
		possibleOptionsTo: []
	},
	onChangeAmount: (): void => undefined,
	onUpdateSelectedOptionFrom: (): void => undefined,
	onUpdateSelectedOptionTo: (): void => undefined,
	onSwitchSelectedOptions: (): void => undefined,
	isDepositing: true,
	maxDepositPossible: toNormalizedBN(0),
	currentSolver: Solver?.VANILLA || 'Vanilla'
};

function useContextualIs(selectedTo: TDropdownOption | undefined, currentVault: TYearnVault): [boolean, boolean] {
	const {networks} = useSettings();
	const {safeChainID} = useChainID();

	const isDepositing = useMemo((): boolean => (
		!selectedTo?.value || toAddress(selectedTo.value) === toAddress(currentVault.address)
	), [selectedTo?.value, currentVault.address]);

	const isPartnerAddressValid = useMemo((): boolean => (
		!isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress))
	), [networks, safeChainID]);

	const isUsingPartnerContract = useMemo((): boolean => (
		(process?.env?.SHOULD_USE_PARTNER_CONTRACT === undefined ? true : Boolean(process?.env?.SHOULD_USE_PARTNER_CONTRACT)) && isPartnerAddressValid
	), [isPartnerAddressValid]);

	return [isDepositing, isUsingPartnerContract];
}

type TGetMaxDepositPossible = {
	vault: TYearnVault,
	fromToken: TAddress,
	fromDecimals: number,
	fromTokenBalance: BigNumber,
	isDepositing: boolean
}
function	getMaxDepositPossible({vault, fromToken, fromDecimals, isDepositing, fromTokenBalance}: TGetMaxDepositPossible): TNormalizedBN {
	const	vaultDepositLimit = formatBN(vault?.details?.depositLimit);
	const	userBalance = formatBN(fromTokenBalance);

	if (fromToken === vault?.token?.address && isDepositing) {
		if (userBalance.gt(vaultDepositLimit)) {
			return (toNormalizedBN(vaultDepositLimit, vault.token.decimals));
		}
	}

	return (toNormalizedBN(userBalance, fromDecimals));
}

const ActionFlowContext = createContext<TActionFlowContext>(DefaultActionFlowContext);
function ActionFlowContextApp({children, currentVault}: {children: ReactNode, currentVault: TYearnVault}): React.ReactElement {
	const {balances, balancesNonce} = useWallet();
	const {safeChainID} = useChainID();
	const {balances: zapBalances, tokensList} = useWalletForZap();
	const {zapProvider} = useYearn();

	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsFrom, set_possibleZapOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsTo, set_possibleZapOptionsTo] = useState<TDropdownOption[]>([]);

	//Combine selectedOptionFrom, selectedOptionTo and amount in a useReducer
	const [actionParams, actionParamsDispatcher] = useReducer((
		state: TActionParams,
		action: {type: 'amount' | 'options' | 'all', payload: Partial<TActionParams>}
	): TActionParams => {
		switch (action.type) {
			case 'amount':
				return {...state, amount: action.payload.amount || toNormalizedBN(0)};
			case 'options':
				return {
					...state,
					isReady: true,
					selectedOptionFrom: action.payload.selectedOptionFrom,
					selectedOptionTo: action.payload.selectedOptionTo,
					possibleOptionsFrom: action.payload.possibleOptionsFrom || [],
					possibleOptionsTo: action.payload.possibleOptionsTo || []
				};
			case 'all':
				return {
					...state,
					isReady: true,
					selectedOptionFrom: action.payload.selectedOptionFrom,
					selectedOptionTo: action.payload.selectedOptionTo,
					amount: action.payload.amount || toNormalizedBN(0)
				};
			default:
				return state;
		}
	}, {
		isReady: false,
		selectedOptionFrom: undefined,
		selectedOptionTo: undefined,
		possibleOptionsFrom: [],
		possibleOptionsTo: [],
		amount: toNormalizedBN(0)
	});
	const [isDepositing, isUsingPartnerContract] = useContextualIs(actionParams?.selectedOptionTo, currentVault);

	const maxDepositPossible = getMaxDepositPossible({
		vault: currentVault,
		fromToken: toAddress(actionParams?.selectedOptionFrom?.value),
		fromDecimals: actionParams?.selectedOptionFrom?.decimals || currentVault?.token?.decimals || 18,
		fromTokenBalance: formatBN(balances?.[toAddress(actionParams?.selectedOptionFrom?.value)]?.raw),
		isDepositing
	});

	const currentSolver = useMemo((): Solver => {
		const isInputTokenEth = actionParams?.selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
		const isOutputTokenEth = actionParams?.selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
		if (isInputTokenEth || isOutputTokenEth) {
			return Solver.CHAIN_COIN;
		}
		if (currentVault?.migration?.available && (toAddress(actionParams?.selectedOptionTo?.value) === toAddress(currentVault?.migration?.address))) {
			return Solver.INTERNAL_MIGRATION;
		}
		if (isDepositing && actionParams?.selectedOptionFrom?.solveVia?.includes(zapProvider) && !isSolverDisabled[zapProvider]) {
			return zapProvider;
		} if (!isDepositing && actionParams?.selectedOptionTo?.solveVia?.includes(zapProvider) && !isSolverDisabled[zapProvider]) {
			return zapProvider;
		}
		if (isDepositing && isUsingPartnerContract) {
			return Solver.PARTNER_CONTRACT;
		}
		return Solver.VANILLA;
	}, [actionParams?.selectedOptionFrom?.value, actionParams?.selectedOptionFrom?.solveVia, actionParams?.selectedOptionTo?.value, actionParams?.selectedOptionTo?.solveVia, currentVault?.migration?.address, currentVault?.migration?.available, isDepositing, zapProvider, isUsingPartnerContract]);

	const onSwitchSelectedOptions = useCallback((nextFlow = Flow.Switch): void => {
		balancesNonce;
		if (nextFlow === Flow.Switch) {
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
		}


		const	vaultUnderlying = setZapOption({
			name: currentVault?.token?.display_name || currentVault?.token?.name,
			symbol: currentVault?.token?.symbol,
			address: toAddress(currentVault.token.address),
			chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
			decimals: currentVault?.token?.decimals || 18
		});
		const	vaultToken = setZapOption({
			name: currentVault?.display_name || currentVault?.name || currentVault.formated_name,
			symbol: currentVault?.display_symbol || currentVault.symbol,
			address: toAddress(currentVault.address),
			chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
			decimals: currentVault?.decimals || 18
		});

		if (nextFlow === Flow.Deposit) {
			actionParamsDispatcher({
				type: 'all',
				payload: {
					selectedOptionFrom: vaultUnderlying,
					selectedOptionTo: vaultToken,
					possibleOptionsFrom: possibleOptionsFrom,
					possibleOptionsTo: possibleOptionsTo,
					amount: toNormalizedBN(0)
				}
			});
		} else if (nextFlow === Flow.Withdraw) {
			actionParamsDispatcher({
				type: 'all',
				payload: {
					selectedOptionFrom: vaultToken,
					selectedOptionTo: vaultUnderlying,
					possibleOptionsFrom: possibleOptionsTo,
					possibleOptionsTo: possibleOptionsFrom,
					amount: toNormalizedBN(0)
				}
			});
		} else if (nextFlow === Flow.Migrate) {
			const	userBalance = formatBN(balances?.[toAddress(currentVault?.address)]?.raw);
			const	_amount = toNormalizedBN(userBalance, currentVault?.decimals || currentVault?.token?.decimals || 18);
			actionParamsDispatcher({
				type: 'all',
				payload: {
					selectedOptionFrom: vaultToken,
					selectedOptionTo: setZapOption({
						name: currentVault?.name,
						symbol: currentVault?.symbol,
						address: currentVault?.migration?.address,
						chainID: currentVault?.chainID,
						decimals: currentVault?.token?.decimals
					}),
					possibleOptionsFrom: possibleOptionsTo,
					possibleOptionsTo: possibleOptionsFrom,
					amount: _amount
				}
			});
		}
	}, [actionParams?.selectedOptionTo, possibleOptionsTo, actionParams?.selectedOptionFrom, possibleOptionsFrom, isDepositing, maxDepositPossible, currentVault, balances, balancesNonce, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** FLOW: Update From/To/Amount in one unique re-render
	**
	** The `updateParams` function is a callback function used to update the parameters (amount,
	** selectedOptionFrom, and selectedOptionTo) in the actionParams state variable.
	** It takes in two parameters: `_selectedFrom` and `_selectedTo`. It then sets the `_amount`
	** variable to 0 if the user is depositing. If the selected token from the dropdown matches the
	** token address associated with the currentVault, the amount is set to the vaultDeposit limit.
	** If not, the amount is set to the user balance for that token.
	**********************************************************************************************/
	const	updateParams = useCallback((_selectedFrom: TDropdownOption, _selectedTo: TDropdownOption): void => {
		const	userBalance = formatBN(balances?.[toAddress(_selectedFrom?.value)]?.raw);
		let	_amount = toNormalizedBN(userBalance, _selectedFrom?.decimals || currentVault?.token?.decimals || 18);
		if (isDepositing) {
			const	vaultDepositLimit = formatBN(currentVault?.details?.depositLimit);
			if (_selectedFrom?.value === currentVault?.token?.address) {
				if (userBalance.gt(vaultDepositLimit)) {
					_amount = toNormalizedBN(vaultDepositLimit, currentVault.token.decimals);
				}
			}
		}

		actionParamsDispatcher({
			type: 'all',
			payload: {
				selectedOptionFrom: _selectedFrom,
				selectedOptionTo: _selectedTo,
				amount: _amount
			}
		});
	}, [balances, currentVault.details.depositLimit, currentVault.token?.address, currentVault.token.decimals, isDepositing]);

	/* 🔵 - Yearn Finance **************************************************************************
	** FLOW: Init the possibleOptionsFrom and possibleOptionsTo arrays and the selectedOptionFrom
	** and selectedOptionTo.
	**
	** If the token to deposit is wETH, we can also deposit ETH via our custom Zap contract. In
	** order to be able to do that, we need to be able to select ETH or wETH as the token to, and
	** so, we need to create the "possibleOptionsFrom" array.
	** Selected from and to are also set here as the default values for that vault, aka the
	** vault underlying token and the vault token.
	**********************************************************************************************/
	useMountEffect((): void => {
		const	payloadFrom: TDropdownOption[] = [];
		const	payloadTo: TDropdownOption[] = [];

		/* 🔵 - Yearn Finance **********************************************************************
		** Init possibleOptionsFrom and possibleOptionsTo arrays.
		******************************************************************************************/
		if (safeChainID === 1 && currentVault && toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			payloadFrom.push(...[
				setZapOption({name: 'ETH', symbol: 'ETH', address: ETH_TOKEN_ADDRESS, chainID: safeChainID, decimals: 18}),
				setZapOption({name: 'wETH', symbol: 'wETH', address: WETH_TOKEN_ADDRESS, chainID: safeChainID, decimals: 18})
			]);
		} else if (safeChainID === 250 && currentVault && toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
			payloadFrom.push(...[
				setZapOption({name: 'FTM', symbol: 'FTM', address: ETH_TOKEN_ADDRESS, chainID: safeChainID, decimals: 18}),
				setZapOption({name: 'wFTM', symbol: 'wFTM', address: WFTM_TOKEN_ADDRESS, chainID: safeChainID, decimals: 18})
			]);
		} else {
			payloadFrom.push(
				setZapOption({
					name: currentVault?.token?.display_name || currentVault?.token?.name,
					symbol: currentVault?.token?.symbol,
					address: toAddress(currentVault.token.address),
					chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
					decimals: currentVault?.token?.decimals || 18
				})
			);
			payloadTo.push(
				setZapOption({
					name: currentVault?.display_name || currentVault?.name,
					symbol: currentVault?.symbol,
					address: toAddress(currentVault.address),
					chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
					decimals: currentVault?.decimals || 18
				})
			);
		}

		/* 🔵 - Yearn Finance **********************************************************************
		** Init selectedFrom and selectedTo as default, aka underlyingToken to vaultToken.
		******************************************************************************************/
		const	_selectedFrom = setZapOption({
			name: currentVault?.token?.display_name || currentVault?.token?.name,
			symbol: currentVault?.token?.symbol,
			address: toAddress(currentVault.token.address),
			chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
			decimals: currentVault?.token?.decimals || 18
		});
		const	_selectedTo = setZapOption({
			name: currentVault?.display_name || currentVault?.name || currentVault.formated_name,
			symbol: currentVault?.display_symbol || currentVault.symbol,
			address: toAddress(currentVault.address),
			chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
			decimals: currentVault?.decimals || 18
		});

		/* 🔵 - Yearn Finance **********************************************************************
		** Update the possibleOptions local state and the actionParams global state.
		******************************************************************************************/
		performBatchedUpdates((): void => {
			set_possibleOptionsFrom(payloadFrom);
			set_possibleOptionsTo(payloadTo);
			actionParamsDispatcher({
				type: 'options',
				payload: {
					selectedOptionFrom: _selectedFrom,
					selectedOptionTo: _selectedTo,
					possibleOptionsFrom: payloadFrom,
					possibleOptionsTo: payloadTo
				}
			});
		});
	});

	/* 🔵 - Yearn Finance **************************************************************************
	** FLOW: Init the possibleZapOptionsFrom array.
	**
	** This array will be used to populate the dropdown list of tokens to deposit via the zap
	** feature.
	** The WETH/WFTM token is not included in the list if the vault is already using WETH/WFTM.
	** The underlying token is not included in the list if the vault is already using it.
	** The vault token is not included in the list because this has no sense.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		const	_possibleZapOptionsFrom: TDropdownOption[] = [];
		const	isWithWETH = safeChainID === 1 && currentVault && toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS;
		const	isWithWFTM = safeChainID === 250 && currentVault && toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS;
		Object.entries(zapBalances || {})
			.filter((): boolean => safeChainID === currentVault?.chainID) // Disable if we are on the wrong chain
			.forEach(([tokenAddress]): void => {
				const	tokenListData = tokensList[toAddress(tokenAddress)];
				if (isWithWETH && toAddress(tokenListData?.address) === WETH_TOKEN_ADDRESS) {
				// Do nothing to avoid duplicate wETH in the list
				} else if (isWithWFTM && toAddress(tokenListData?.address) === WFTM_TOKEN_ADDRESS) {
				// Do nothing to avoid duplicate wFTM in the list
				} else if (toAddress(tokenListData?.address) === toAddress(currentVault?.token?.address)) {
				// Do nothing to avoid duplicate vault underlying token in the list
				} else if (toAddress(tokenListData?.address) === toAddress(currentVault?.address)) {
				// Do nothing to avoid vault token in the list
				} else {
					_possibleZapOptionsFrom.push(
						setZapOption({
							name: tokenListData?.name,
							symbol: tokenListData?.symbol,
							address: toAddress(tokenListData?.address),
							chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
							decimals: tokenListData?.decimals,
							solveVia: tokenListData?.supportedZaps || []
						})
					);
				}
			});
		set_possibleZapOptionsFrom(_possibleZapOptionsFrom);
	}, [safeChainID, tokensList, zapBalances, balancesNonce, currentVault]);

	/* 🔵 - Yearn Finance **************************************************************************
	** FLOW: Init the possibleZapOptionsTo array.
	**
	** This array will be used to populate the dropdown list of tokens to withdraw via the zap
	** feature.
	** This list is always the same, and is not dependent on the vault.
	**********************************************************************************************/
	useEffect((): void => {
		const	_possibleZapOptionsTo: TDropdownOption[] = [];
		externalzapOutTokenList
			.filter((): boolean => safeChainID === currentVault?.chainID) // Disable if we are on the wrong chain
			.filter((token): boolean => token.chainID === (currentVault?.chainID || safeChainID))
			.forEach((tokenListData): void => {
				_possibleZapOptionsTo.push(
					setZapOption({
						name: tokenListData?.name,
						symbol: tokenListData?.symbol,
						address: toAddress(tokenListData?.address),
						chainID: currentVault?.chainID === 1337 ? safeChainID : currentVault?.chainID,
						decimals: tokenListData?.decimals,
						solveVia: (tokenListData?.supportedZaps as Solver[]) || []
					})
				);
			});
		set_possibleZapOptionsTo(_possibleZapOptionsTo);
	}, [currentVault?.chainID, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** FLOW: Store the value from that context in a Memoized variable to avoid useless re-renders
	**********************************************************************************************/
	const	contextValue = useMemo((): TActionFlowContext => ({
		currentVault,
		possibleOptionsFrom: [...actionParams.possibleOptionsFrom, ...possibleZapOptionsFrom],
		possibleOptionsTo: [...actionParams.possibleOptionsTo, ...possibleZapOptionsTo],
		actionParams,
		onChangeAmount: (newAmount: TNormalizedBN): void => {
			actionParamsDispatcher({type: 'amount', payload: {amount: newAmount}});
		},
		onUpdateSelectedOptionFrom: (newSelectedOptionFrom: TDropdownOption): void => {
			updateParams(newSelectedOptionFrom, actionParams?.selectedOptionTo as TDropdownOption);
		},
		onUpdateSelectedOptionTo: (newSelectedOptionTo: TDropdownOption): void => {
			updateParams(actionParams?.selectedOptionFrom as TDropdownOption, newSelectedOptionTo);
		},
		onSwitchSelectedOptions,
		isDepositing,
		maxDepositPossible,
		currentSolver
	}), [currentVault, possibleZapOptionsFrom, possibleZapOptionsTo, actionParams, onSwitchSelectedOptions, isDepositing, maxDepositPossible, currentSolver, updateParams]);

	return (
		<ActionFlowContext.Provider value={contextValue}>
			{children}
		</ActionFlowContext.Provider>
	);
}

export const useActionFlow = (): TActionFlowContext => useContext(ActionFlowContext);
export default ActionFlowContextApp;
