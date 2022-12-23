import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {Solver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {setZapOption} from '@vaults/utils/zapOptions';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useWallet} from '@common/contexts/useWallet';
import {DefaultTNormalizedBN} from '@common/utils';

import type {ReactNode} from 'react';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

type	TActionFlowContext = {
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
	maxDepositPossible: TNormalizedBN;
	currentSolver: Solver;
}
const	DefaultActionFlowContext: TActionFlowContext = {
	currentVault: {} as TYearnVault, // eslint-disable-line @typescript-eslint/consistent-type-assertions
	possibleOptionsFrom: [],
	possibleOptionsTo: [],
	selectedOptionFrom: undefined,
	selectedOptionTo: undefined,
	amount: DefaultTNormalizedBN,
	onChangeAmount: (): void => undefined,
	onUpdateSelectedOptionFrom: (): void => undefined,
	onUpdateSelectedOptionTo: (): void => undefined,
	onSwitchSelectedOptions: (): void => undefined,
	isDepositing: true,
	maxDepositPossible: DefaultTNormalizedBN,
	currentSolver: Solver.VANILLA
};

const ActionFlowContext = createContext<TActionFlowContext>(DefaultActionFlowContext);
function ActionFlowContextApp({children, currentVault}: {children: ReactNode, currentVault: TYearnVault}): React.ReactElement {
	const {balances} = useWallet();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();
	const {balances: zapBalances, tokensList} = useWalletForZap();

	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsFrom, set_possibleZapOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	const [selectedOptionFrom, set_selectedOptionFrom] = useState<TDropdownOption | undefined>();
	const [selectedOptionTo, set_selectedOptionTo] = useState<TDropdownOption | undefined>();
	const [amount, set_amount] = useState<TNormalizedBN>(DefaultTNormalizedBN);

	const isDepositing = useMemo((): boolean => (
		!selectedOptionTo?.value || toAddress(selectedOptionTo.value) === toAddress(currentVault.address)
	), [selectedOptionTo, currentVault]);

	const isPartnerAddressValid = useMemo((): boolean => (
		!isZeroAddress(toAddress(networks?.[safeChainID]?.partnerContractAddress))
	), [networks, safeChainID]);

	const isUsingPartnerContract = useMemo((): boolean => (
		(process?.env?.SHOULD_USE_PARTNER_CONTRACT === undefined ? true : Boolean(process?.env?.SHOULD_USE_PARTNER_CONTRACT)) && isPartnerAddressValid
	), [isPartnerAddressValid]);

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

	const currentSolver = useMemo((): Solver => {
		const isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
		const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;
		if (isInputTokenEth || isOutputTokenEth) {
			return Solver.CHAIN_COIN;
		}
		if (selectedOptionFrom?.solveVia === Solver.COWSWAP) {
			return Solver.COWSWAP;			
		}
		if (isDepositing && isUsingPartnerContract) {
			return Solver.PARTNER_CONTRACT;
		}
		return Solver.VANILLA;
	}, [isDepositing, isUsingPartnerContract, selectedOptionFrom?.solveVia, selectedOptionFrom?.value, selectedOptionTo?.value]);

	const onSwitchSelectedOptions = useCallback((): void => {
		performBatchedUpdates((): void => {
			const _selectedOptionTo = selectedOptionTo;
			const _possibleOptionsTo = possibleOptionsTo;
			set_selectedOptionTo(selectedOptionFrom);
			set_selectedOptionFrom(_selectedOptionTo);
			set_possibleOptionsTo(possibleOptionsFrom);
			set_possibleOptionsFrom(_possibleOptionsTo);
			if (isDepositing) {
				set_amount(DefaultTNormalizedBN);
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
						decimals: currentVault?.token?.decimals || 18
					})
				]);
			}
		}
	}, [currentVault, isDepositing, safeChainID]);


	useEffect((): void => {
		const	_possibleZapOptionsFrom: TDropdownOption[] = [];
		Object.entries(zapBalances || {}).forEach(([tokenAddress]): void => {
			const	tokenListData = tokensList[toAddress(tokenAddress)];
			_possibleZapOptionsFrom.push(
				setZapOption({
					name: tokenListData?.name,
					symbol: tokenListData?.symbol,
					address: toAddress(tokenListData?.address),
					safeChainID,
					decimals: tokenListData?.decimals,
					solveVia: Solver.COWSWAP //Should handle multiple
				})
			);
		});
		set_possibleZapOptionsFrom(_possibleZapOptionsFrom);
	}, [safeChainID, tokensList, zapBalances]);

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
				decimals: currentVault?.token?.decimals || 18
			});
			const	_selectedTo = setZapOption({
				name: currentVault?.display_name || currentVault?.name || currentVault.formated_name,
				symbol: currentVault?.display_symbol || currentVault.symbol,
				address: toAddress(currentVault.address),
				safeChainID,
				decimals: currentVault?.decimals || 18
			});
			performBatchedUpdates((): void => {
				set_selectedOptionFrom(_selectedFrom);
				set_selectedOptionTo(_selectedTo);
			});
		}
	}, [selectedOptionFrom, selectedOptionTo, currentVault, safeChainID]);
	
	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TActionFlowContext => ({
		currentVault,
		possibleOptionsFrom: [...possibleOptionsFrom, ...possibleZapOptionsFrom],
		possibleOptionsTo,
		selectedOptionFrom,
		selectedOptionTo,
		amount,
		onChangeAmount: set_amount,
		onUpdateSelectedOptionFrom: set_selectedOptionFrom,
		onUpdateSelectedOptionTo: set_selectedOptionTo,
		onSwitchSelectedOptions: onSwitchSelectedOptions,
		isDepositing,
		maxDepositPossible,
		currentSolver
	}), [currentVault, possibleOptionsFrom, possibleOptionsTo, selectedOptionFrom, selectedOptionTo, amount, onSwitchSelectedOptions, isDepositing, maxDepositPossible, currentSolver, possibleZapOptionsFrom]);

	return (
		<ActionFlowContext.Provider value={contextValue}>
			{children}
		</ActionFlowContext.Provider>
	);
}

export const useActionFlow = (): TActionFlowContext => useContext(ActionFlowContext);
export default ActionFlowContextApp;