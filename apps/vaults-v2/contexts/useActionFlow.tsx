import {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react';
import {useRouter} from 'next/router';
import {serialize, useReadContract} from 'wagmi';
import {readContracts, simulateContract} from 'wagmi/actions';
import {useMountEffect} from '@react-hookz/web';
import {Solver} from '@vaults-v2/types/solvers';
import {VAULT_V3_ABI} from '@vaults-v2/utils/abi/vaultV3.abi';
import {VEYFI_ABI} from '@vaults-v2/utils/abi/veYFI.abi';
import {setZapOption} from '@vaults-v2/utils/zapOptions';
import {useWallet} from '@lib/contexts/useWallet';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useYearn} from '@lib/contexts/useYearn';
import {useTokenList} from '@lib/contexts/WithTokenList';
import {useAsyncTrigger} from '@lib/hooks/useAsyncTrigger';
import {
	decodeAsBigInt,
	isEthAddress,
	isZero,
	isZeroAddress,
	toAddress,
	toBigInt,
	toNormalizedBN,
	zeroNormalizedBN
} from '@lib/utils';
import {VAULT_ABI} from '@lib/utils/abi/vault.abi';
import {
	ETH_TOKEN_ADDRESS,
	LPYCRV_TOKEN_ADDRESS,
	OPT_WETH_TOKEN_ADDRESS,
	VEYFI_ADDRESS,
	WETH_TOKEN_ADDRESS,
	WFTM_TOKEN_ADDRESS,
	YVWETH_ADDRESS,
	YVWETH_OPT_ADDRESS,
	YVWFTM_ADDRESS
} from '@lib/utils/constants';
import externalzapOutTokenList from '@lib/utils/externalZapOutTokenList.json';
import {createUniqueID} from '@lib/utils/tools.identifier';
import {retrieveConfig} from '@lib/utils/wagmi';
import {getNetwork} from '@lib/utils/wagmi/utils';

import type {ReactNode} from 'react';
import type {TAddress, TDropdownOption, TNormalizedBN} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSolver} from '@vaults-v2/types/solvers';

export enum Flow {
	Deposit = 'deposit',
	Withdraw = 'withdraw',
	Migrate = 'migrate',
	Zap = 'zap', // TODO: create this flow handler
	Switch = 'switch',
	None = 'none'
}

type TActionParams = {
	isReady: boolean;
	amount: undefined | TNormalizedBN;
	selectedOptionFrom: TDropdownOption | undefined;
	selectedOptionTo: TDropdownOption | undefined;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
};
type TActionFlowContext = {
	currentVault: TYDaemonVault;
	possibleOptionsFrom: TDropdownOption[];
	possibleOptionsTo: TDropdownOption[];
	actionParams: TActionParams;
	onChangeAmount: (amount: TNormalizedBN | undefined) => void;
	onUpdateSelectedOptionFrom: (option: TDropdownOption) => void;
	onUpdateSelectedOptionTo: (option: TDropdownOption) => void;
	onSwitchSelectedOptions: (nextFlow?: Flow) => void;
	isDepositing: boolean;
	maxDepositPossible: (address: TAddress) => TNormalizedBN;
	maxWithdrawPossible: () => {limit: TNormalizedBN; safeLimit: TNormalizedBN; isLimited: boolean};
	currentSolver: TSolver;
	veYFIBalance: TNormalizedBN;
	hasVeYFIBalance: boolean;
};
const DefaultActionFlowContext: TActionFlowContext = {
	currentVault: {} as TYDaemonVault, // eslint-disable-line @typescript-eslint/consistent-type-assertions
	possibleOptionsFrom: [],
	possibleOptionsTo: [],
	actionParams: {
		isReady: false,
		amount: zeroNormalizedBN,
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
	maxDepositPossible: (): TNormalizedBN => zeroNormalizedBN,
	maxWithdrawPossible: () => ({
		limit: zeroNormalizedBN,
		safeLimit: zeroNormalizedBN,
		isLimited: false
	}),
	currentSolver: Solver.enum.Vanilla || 'Vanilla',
	veYFIBalance: zeroNormalizedBN,
	hasVeYFIBalance: false
};

type TUseContextualIs = {
	selectedTo?: TDropdownOption;
	currentVault: TYDaemonVault;
};

/**************************************************************************************************
 ** The useContextualIs hook is used to determine if the user is depositing or withdrawing from a
 ** vault, and if the partner contract should be used.
 ** It's a simple helper to make the code more readable in the main context.
 *************************************************************************************************/
function useContextualIs({selectedTo, currentVault}: TUseContextualIs): [boolean, boolean] {
	const router = useRouter();

	const isDepositing = useMemo(
		(): boolean =>
			(!router.query.action || router.query.action === 'deposit') &&
			(!selectedTo?.value || toAddress(selectedTo?.value) === toAddress(currentVault.address)),
		[selectedTo?.value, currentVault.address, router.query.action]
	);

	const isPartnerAddressValid = useMemo(
		(): boolean => !isZeroAddress(getNetwork(currentVault.chainID)?.contracts?.partnerContract?.address),
		[currentVault.chainID]
	);

	const isUsingPartnerContract = useMemo(
		(): boolean =>
			(process?.env?.SHOULD_USE_PARTNER_CONTRACT === undefined
				? true
				: Boolean(process?.env?.SHOULD_USE_PARTNER_CONTRACT)) && isPartnerAddressValid,
		[isPartnerAddressValid]
	);

	return [isDepositing, isUsingPartnerContract];
}

/**************************************************************************************************
 ** The getMaxDepositPossible function is used to determine the maximum amount the user can deposit
 ** into the vault.
 ** This function performs no external calls and will just try to determine the maximum amount
 ** based on the provided parameters.
 *************************************************************************************************/
type TGetMaxDepositPossible = {
	vault: TYDaemonVault;
	fromToken: TAddress;
	fromDecimals: number;
	fromTokenBalance: bigint;
	isDepositing: boolean;
	depositLimit: bigint;
};
function getMaxDepositPossible(props: TGetMaxDepositPossible): TNormalizedBN {
	const {vault, fromToken, fromDecimals, isDepositing, fromTokenBalance, depositLimit} = props;
	const vaultDepositLimit = toBigInt(depositLimit);
	const userBalance = toBigInt(fromTokenBalance);

	if (fromToken === vault?.token?.address && isDepositing) {
		if (userBalance > vaultDepositLimit) {
			return toNormalizedBN(vaultDepositLimit, vault.token.decimals);
		}
	}

	return toNormalizedBN(userBalance, fromDecimals);
}

/**************************************************************************************************
 ** The ActionFlowContext is a context provider specific to the vault page, aiming to orchestrate
 ** the deposit, withdraw, and migration flows.
 ** This groups the different deposit options, the different withdraw options, the inputed amount,
 ** and more elements, and this tries to put limits and determine the best solvers for the user.
 ** Limits might be the maximum amount the user can deposit for example, based on the vault onchain
 ** data, or it could be the maxRedeem value for the user.
 ** The solvers are the different strategies that can be used to perform the deposit or withdrawal,
 ** like the OptimismBooster, the GaugeStakingBooster, the JuicedStakingBooster, etc, which leads
 ** to different way of depositing/withdrawing.
 *************************************************************************************************/
const ActionFlowContext = createContext<TActionFlowContext>(DefaultActionFlowContext);
export function ActionFlowContextApp(props: {children: ReactNode; currentVault: TYDaemonVault}): React.ReactElement {
	const {address} = useWeb3();
	const {getBalance} = useWallet();
	const {maxLoss} = useYearn();
	const {tokenLists} = useTokenList();
	const {zapProvider, isAutoStakingEnabled} = useYearn();
	const [possibleOptionsFrom, set_possibleOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsFrom, set_possibleZapOptionsFrom] = useState<TDropdownOption[]>([]);
	const [possibleOptionsTo, set_possibleOptionsTo] = useState<TDropdownOption[]>([]);
	const [possibleZapOptionsTo, set_possibleZapOptionsTo] = useState<TDropdownOption[]>([]);
	const [limits, set_limits] = useState<{maxDeposit: bigint; maxRedeem: bigint} | undefined>(undefined);

	/**********************************************************************************************
	 ** currentNetworkTokenList is an object with multiple level of depth. We want to create a
	 ** unique hash from it to know when it changes. This new hash will be used to trigger the
	 ** useEffect hook.
	 *********************************************************************************************/
	const currentTokenListIdentifier = useMemo(() => {
		const hash = createUniqueID(serialize(tokenLists?.[props.currentVault.chainID] || []));
		return hash;
	}, [props.currentVault.chainID, tokenLists]);

	/**********************************************************************************************
	 ** Based on the onchain data, the vault might have different limits both in general and for
	 ** the user. We need to determine what is the maximum amount the user can deposit and the
	 ** maximum amount the user can withdraw.
	 ** Once the raw numbers are fetched, we are using a simple fallback strategy:
	 ** - maxDeposit -> vault.depositLimit() or vault.maxDeposit(user)
	 ** - maxRedeem -> vault.maxRedeem(user, maxLoss) or vault.balanceOf(user)
	 *********************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		if (!address || isZeroAddress(address) || !props.currentVault) {
			return;
		}
		const [_depositLimit, _maxDeposit, _maxRedeem, _balance] = await readContracts(retrieveConfig(), {
			contracts: [
				{
					address: props.currentVault.address,
					abi: VAULT_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'depositLimit'
				},
				{
					address: props.currentVault.address,
					abi: VAULT_V3_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'maxDeposit',
					args: [toAddress(address)]
				},
				{
					address: props.currentVault.address,
					abi: VAULT_V3_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'maxRedeem',
					args: [toAddress(address), toBigInt(maxLoss)]
				},
				{
					address: props.currentVault.address,
					abi: VAULT_V3_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				}
			]
		});

		const balanceOf = decodeAsBigInt(_balance, 0n);
		const maxDeposit = decodeAsBigInt(_depositLimit, decodeAsBigInt(_maxDeposit, 0n));
		const maxRedeemUnchecked = decodeAsBigInt(_maxRedeem, balanceOf);

		// Contract rounds down, if 1n difference, use balanceOf shares.
		const isRedemptionRounded = maxRedeemUnchecked === balanceOf - 1n;
		const maxRedeem = isRedemptionRounded ? balanceOf : maxRedeemUnchecked;

		try {
			// This throws if Vault is V3 as withdraw(balance) does not exist on V3 Vaults.
			const isV3 = props.currentVault.version.startsWith('3') || props.currentVault.version.startsWith('~3');

			if (!isV3) {
				const maxEffectiveWithdraw = await simulateContract(retrieveConfig(), {
					abi: VAULT_ABI,
					address: props.currentVault.address,
					chainId: props.currentVault.chainID,
					functionName: 'withdraw',
					args: [balanceOf]
				});
				set_limits({
					maxDeposit,
					maxRedeem: maxEffectiveWithdraw ? maxEffectiveWithdraw.result : maxRedeem
				});
			} else {
				set_limits({maxDeposit, maxRedeem});
			}
		} catch (error) {
			set_limits({maxDeposit, maxRedeem});
		}
	}, [props.currentVault, address, maxLoss]);

	/**********************************************************************************************
	 ** This reducer is used to manage the actionParams state variable and update the different
	 ** elements in one go rather than multiple set_state. This was done to avoid the multiple
	 ** re-render we had with the previous method.
	 ** 3 actions are available:
	 ** - amount: update the amount when the user types in the input
	 ** - options: update the selectedOptionFrom, selectedOptionTo, possibleOptionsFrom, and
	 **   possibleOptionsTo when the user selects a token from the dropdown
	 ** - all: update everything at once
	 *********************************************************************************************/
	const [actionParams, actionParamsDispatcher] = useReducer(
		(
			state: TActionParams,
			action: {
				type: 'amount' | 'options' | 'all';
				payload: Partial<TActionParams>;
			}
		): TActionParams => {
			switch (action.type) {
				case 'amount':
					return {
						...state,
						amount: action.payload.amount
					};
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
						possibleOptionsFrom: action.payload.possibleOptionsFrom || [],
						possibleOptionsTo: action.payload.possibleOptionsTo || [],
						amount: action.payload.amount || zeroNormalizedBN
					};
				default:
					return state;
			}
		},
		{
			isReady: false,
			selectedOptionFrom: undefined,
			selectedOptionTo: undefined,
			possibleOptionsFrom: [],
			possibleOptionsTo: [],
			amount: zeroNormalizedBN
		}
	);

	/**********************************************************************************************
	 ** Simple helper to determine if the user is depositing or withdrawing from the vault, and if
	 ** the partner contract should be used.
	 *********************************************************************************************/
	const [isDepositing, isUsingPartnerContract] = useContextualIs({
		selectedTo: actionParams?.selectedOptionTo,
		currentVault: props.currentVault
	});

	/**********************************************************************************************
	 ** Callback function used to get the maximum amount a specific user can withdraw from the
	 ** vault. This is based on the maxRedeem value from the vault and the user balance:
	 ** If the user balance is greater than the maxRedeem value, the user can only withdraw the
	 ** maxRedeem value, and as this means that the vault has a limit on this, and as this limit
	 ** can slightly change on every blocks, using this raw number might lead to revert. To prevent
	 ** this, we are using a safeLimit which is 99% of the maxRedeem value.
	 ** If the user balance is less than the maxRedeem value, the user can withdraw the full
	 ** balance and we don't need to care about the safeLimit.
	 ** The safeLimit specificity is only available for V3 vaults.
	 *********************************************************************************************/
	const maxWithdrawPossible = useCallback(() => {
		const vaultBalance = getBalance({
			address: toAddress(props.currentVault.address),
			chainID: props.currentVault.chainID
		});

		const balance = toBigInt(vaultBalance.raw);
		const maxRedeemWithRoundingSafety = toBigInt(limits?.maxRedeem) + 10n;

		if (props.currentVault.version.startsWith('3') || props.currentVault.version.startsWith('~3')) {
			const safeLimit = (toBigInt(limits?.maxRedeem) * 99n) / 100n;
			return {
				limit: toNormalizedBN(toBigInt(limits?.maxRedeem), props.currentVault.token.decimals),
				safeLimit:
					balance > maxRedeemWithRoundingSafety
						? toNormalizedBN(safeLimit, props.currentVault.token.decimals)
						: toNormalizedBN(toBigInt(limits?.maxRedeem), props.currentVault.token.decimals),
				isLimited: balance > maxRedeemWithRoundingSafety
			};
		}
		if (toBigInt(limits?.maxRedeem) < balance) {
			return {
				limit: toNormalizedBN(toBigInt(limits?.maxRedeem), props.currentVault.token.decimals),
				safeLimit: toNormalizedBN(toBigInt(limits?.maxRedeem), props.currentVault.token.decimals),
				isLimited: true
			};
		}
		return {limit: vaultBalance, safeLimit: vaultBalance, isLimited: false};
	}, [getBalance, props.currentVault, limits?.maxRedeem]);

	/**********************************************************************************************
	 ** Callback function used to get the maximum amount a specific user can deposit into the
	 ** vault. This is based on the maxDeposit value from the vault and the user balance.
	 *********************************************************************************************/
	const maxDepositPossible = useCallback(
		(tokenAddress: TAddress): TNormalizedBN => {
			if (isZeroAddress(tokenAddress)) {
				return zeroNormalizedBN;
			}
			const tokenBalance = getBalance({
				address: toAddress(tokenAddress),
				chainID: props.currentVault.chainID
			});

			return getMaxDepositPossible({
				vault: props.currentVault,
				fromToken: toAddress(tokenAddress),
				fromDecimals: actionParams?.selectedOptionFrom?.decimals || props.currentVault?.token?.decimals || 18,
				fromTokenBalance: tokenBalance.raw,
				isDepositing,
				depositLimit: toBigInt(limits?.maxDeposit)
			});
		},
		[getBalance, props.currentVault, actionParams?.selectedOptionFrom?.decimals, isDepositing, limits?.maxDeposit]
	);

	const currentTimestamp = Math.floor(Date.now() / 1000);
	const {data} = useReadContract({
		address: toAddress(VEYFI_ADDRESS),
		abi: VEYFI_ABI,
		functionName: 'locked',
		args: [toAddress(address)],
		query: {
			enabled: !isZeroAddress(address) && props.currentVault.staking.source === 'VeYFI'
		}
	});

	const {amount: veYFIBalance = 0n, end: lockEnds = 0n} = (data as {amount: bigint; end: bigint} | undefined) || {};
	const hasVeYFIBalance = veYFIBalance > 0n && lockEnds > currentTimestamp;

	/**********************************************************************************************
	 ** The currentSolver is a memoized value that determines which solver should be used based on
	 ** the current context.
	 *********************************************************************************************/
	const currentSolver = useMemo((): TSolver => {
		const isUnderlyingToken =
			toAddress(actionParams?.selectedOptionFrom?.value) === toAddress(props.currentVault.token.address);

		// Only use OptimismBooster if the user chose to stake automatically and the vault is staking with OP Boost
		if (
			props.currentVault.staking.available &&
			props.currentVault.staking.source === 'OP Boost' &&
			isAutoStakingEnabled &&
			isDepositing &&
			isUnderlyingToken
		) {
			return Solver.enum.OptimismBooster;
		}

		// Only use GaugeStakingBooster if the user chose to stake automatically, the vault is staking with VeYFI, and user has veYFI balance
		if (
			props.currentVault.staking.available &&
			props.currentVault.staking.source === 'VeYFI' &&
			isAutoStakingEnabled &&
			isDepositing &&
			isUnderlyingToken
		) {
			return Solver.enum.GaugeStakingBooster;
		}

		// Only use JuicedStakingBooster if the user chose to stake automatically and the vault is staking with Juiced
		// Disabled until we figure out the zap
		const canUseJuicedDirectDeposits = false;
		if (
			props.currentVault.staking.available &&
			props.currentVault.staking.source === 'Juiced' &&
			isAutoStakingEnabled &&
			isDepositing &&
			isUnderlyingToken &&
			canUseJuicedDirectDeposits
		) {
			return Solver.enum.JuicedStakingBooster;
		}

		// Only use V3StakingBooster if the user chose to stake automatically and the vault is staking with V3 Staking
		if (
			props.currentVault.staking.available &&
			props.currentVault.staking.source === 'V3 Staking' &&
			isAutoStakingEnabled &&
			isDepositing &&
			isUnderlyingToken
		) {
			return Solver.enum.V3StakingBooster;
		}

		const isV3 =
			props.currentVault?.version.split('.')?.[0] === '3' || props.currentVault?.version.split('.')?.[0] === '~3';
		if (
			props.currentVault?.migration?.available &&
			toAddress(actionParams?.selectedOptionTo?.value) === toAddress(props.currentVault?.migration?.address)
		) {
			return Solver.enum.InternalMigration;
		}
		if (
			isDepositing &&
			toAddress(actionParams?.selectedOptionTo?.value) === toAddress(props.currentVault?.token?.address)
		) {
			return Solver.enum.Vanilla;
		}
		if (
			isDepositing &&
			actionParams?.selectedOptionFrom?.solveVia &&
			(actionParams.selectedOptionFrom.solveVia.length || 0) > 0
		) {
			if (actionParams.selectedOptionFrom.solveVia.includes(zapProvider)) {
				return zapProvider;
			}
			return actionParams?.selectedOptionFrom?.solveVia[0];
		}
		if (
			!isDepositing &&
			actionParams?.selectedOptionTo?.solveVia &&
			(actionParams.selectedOptionTo.solveVia.length || 0) > 0
		) {
			if (actionParams.selectedOptionTo.solveVia.includes(zapProvider)) {
				return zapProvider;
			}
			return actionParams?.selectedOptionTo?.solveVia[0];
		}
		if (isDepositing && isUsingPartnerContract && !isV3) {
			return Solver.enum.PartnerContract;
		}
		return Solver.enum.Vanilla;
	}, [
		actionParams.selectedOptionFrom?.value,
		actionParams.selectedOptionFrom?.solveVia,
		actionParams.selectedOptionTo?.value,
		actionParams.selectedOptionTo?.solveVia,
		props.currentVault.token.address,
		props.currentVault.staking.available,
		props.currentVault.staking.source,
		props.currentVault?.version,
		props.currentVault?.migration?.available,
		props.currentVault?.migration?.address,
		isAutoStakingEnabled,
		isDepositing,
		isUsingPartnerContract,
		zapProvider
	]);

	/**********************************************************************************************
	 ** The onSwitchSelectedOptions function is a callback function used to switch the selected
	 ** options from and to in the actionParams state variable, and adapt the possibleOptionsFrom
	 ** and possibleOptionsTo arrays accordingly.
	 *********************************************************************************************/
	const onSwitchSelectedOptions = useCallback(
		(nextFlow = Flow.Switch): void => {
			if (nextFlow === Flow.None) {
				return;
			}

			if (nextFlow === Flow.Switch) {
				const _selectedOptionTo = actionParams?.selectedOptionTo;
				const _possibleOptionsTo = possibleOptionsTo;
				let _selectedOptionFrom = actionParams?.selectedOptionFrom;
				if (isDepositing && (actionParams?.selectedOptionFrom?.solveVia || []).length > 0) {
					// We don't want to be able to withdraw to exotic tokens. If the current from is one of them, take another one.
					_selectedOptionFrom = possibleOptionsFrom.find(
						(option: TDropdownOption): boolean =>
							option.value !== actionParams?.selectedOptionFrom?.value &&
							isZero((option.solveVia || []).length)
					);
				}
				actionParamsDispatcher({
					type: 'all',
					payload: {
						selectedOptionFrom: _selectedOptionTo,
						selectedOptionTo: _selectedOptionFrom,
						amount: isDepositing
							? zeroNormalizedBN
							: maxDepositPossible(toAddress(_selectedOptionFrom?.value))
					}
				});
				set_possibleOptionsTo(possibleOptionsFrom);
				set_possibleOptionsFrom(_possibleOptionsTo);
				return;
			}

			const vaultUnderlying = setZapOption({
				name: props.currentVault?.token?.name,
				symbol: props.currentVault?.token?.symbol,
				address: toAddress(props.currentVault.token.address),
				chainID: props.currentVault.chainID,
				decimals: props.currentVault?.token?.decimals || 18
			});
			const vaultToken = setZapOption({
				name: props.currentVault?.name,
				symbol: props.currentVault.symbol,
				address: toAddress(props.currentVault.address),
				chainID: props.currentVault.chainID,
				decimals: props.currentVault?.decimals || 18
			});

			if (nextFlow === Flow.Deposit) {
				actionParamsDispatcher({
					type: 'all',
					payload: {
						selectedOptionFrom: vaultUnderlying,
						selectedOptionTo: vaultToken,
						possibleOptionsFrom: possibleOptionsFrom,
						possibleOptionsTo: possibleOptionsTo,
						amount: zeroNormalizedBN
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
						amount: zeroNormalizedBN
					}
				});
			} else if (nextFlow === Flow.Migrate) {
				const userBalance = getBalance({
					address: toAddress(props.currentVault?.address),
					chainID: props.currentVault?.chainID
				}).raw;
				const _amount = toNormalizedBN(
					userBalance,
					props.currentVault?.decimals || props.currentVault?.token?.decimals || 18
				);
				const selectedOptionTo = {
					name: props.currentVault?.name,
					symbol: props.currentVault?.symbol,
					address: props.currentVault?.migration?.address,
					chainID: props.currentVault?.chainID,
					decimals: props.currentVault?.token?.decimals
				};

				if (props.currentVault?.address === LPYCRV_TOKEN_ADDRESS) {
					selectedOptionTo.name = 'lp-yCRV V2';
					selectedOptionTo.symbol = 'lp-yCRV V2';
				}

				actionParamsDispatcher({
					type: 'all',
					payload: {
						selectedOptionFrom: vaultToken,
						selectedOptionTo: setZapOption(selectedOptionTo),
						possibleOptionsFrom: possibleOptionsTo,
						possibleOptionsTo: possibleOptionsFrom,
						amount: _amount
					}
				});
			}
		},
		[
			actionParams?.selectedOptionTo,
			possibleOptionsTo,
			actionParams?.selectedOptionFrom,
			possibleOptionsFrom,
			isDepositing,
			maxDepositPossible,
			props.currentVault,
			getBalance
		]
	);
	console.log(actionParams);
	/**********************************************************************************************
	 ** FLOW: Update From/To/Amount in one unique re-render
	 **
	 ** The `updateParams` function is a callback function used to update the parameters (amount,
	 ** selectedOptionFrom, and selectedOptionTo) in the actionParams state variable.
	 ** It takes in two parameters: `_selectedFrom` and `_selectedTo`. It then sets the `_amount`
	 ** variable to 0 if the user is depositing. If the selected token from the dropdown matches the
	 ** token address associated with the currentVault, the amount is set to the vaultDeposit limit.
	 ** If not, the amount is set to the user balance for that token.
	 **********************************************************************************************/
	const updateParams = useCallback(
		(_selectedFrom: TDropdownOption, _selectedTo: TDropdownOption): void => {
			const userBalance = getBalance({
				address: toAddress(_selectedFrom?.value),
				chainID: props.currentVault.chainID
			}).raw;
			let _amount = toNormalizedBN(
				userBalance,
				_selectedFrom?.decimals || props.currentVault?.token?.decimals || 18
			);
			if (isDepositing) {
				if (_selectedFrom?.value === props.currentVault?.token?.address) {
					if (userBalance > toBigInt(limits?.maxDeposit)) {
						_amount = toNormalizedBN(toBigInt(limits?.maxDeposit), props.currentVault.token.decimals);
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
		},
		[
			getBalance,
			props.currentVault.chainID,
			props.currentVault.token.decimals,
			props.currentVault.token?.address,
			isDepositing,
			limits?.maxDeposit
		]
	);

	/**********************************************************************************************
	 ** FLOW: Update selectedOptionFrom
	 **
	 ** Update the amount property with the new one provided by the user.
	 **********************************************************************************************/
	const onChangeAmount = useCallback((newAmount: TNormalizedBN | undefined): void => {
		actionParamsDispatcher({
			type: 'amount',
			payload: {amount: newAmount}
		});
	}, []);

	/**********************************************************************************************
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
		const payloadFrom: TDropdownOption[] = [];
		const payloadTo: TDropdownOption[] = [];

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Init possibleOptionsFrom and possibleOptionsTo arrays.
		 ******************************************************************************************/
		if (
			props.currentVault.chainID === 1 &&
			props.currentVault &&
			toAddress(props.currentVault.token.address) === WETH_TOKEN_ADDRESS &&
			toAddress(props.currentVault.address) === YVWETH_ADDRESS
		) {
			payloadFrom.push(
				...[
					setZapOption({
						name: 'ETH',
						symbol: 'ETH',
						address: ETH_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18,
						solveVia: ['Portals']
					}),
					setZapOption({
						name: 'wETH',
						symbol: 'wETH',
						address: WETH_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18
					})
				]
			);
		} else if (
			props.currentVault.chainID === 250 &&
			props.currentVault &&
			toAddress(props.currentVault.token.address) === WFTM_TOKEN_ADDRESS &&
			toAddress(props.currentVault.address) === YVWFTM_ADDRESS
		) {
			payloadFrom.push(
				...[
					setZapOption({
						name: 'FTM',
						symbol: 'FTM',
						address: ETH_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18,
						solveVia: ['Portals']
					}),
					setZapOption({
						name: 'wFTM',
						symbol: 'wFTM',
						address: WFTM_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18
					})
				]
			);
		} else if (
			props.currentVault.chainID === 10 &&
			props.currentVault &&
			toAddress(props.currentVault.token.address) === OPT_WETH_TOKEN_ADDRESS &&
			props.currentVault.address === YVWETH_OPT_ADDRESS
		) {
			payloadFrom.push(
				...[
					setZapOption({
						name: 'ETH',
						symbol: 'ETH',
						address: ETH_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18,
						solveVia: ['Portals']
					}),
					setZapOption({
						name: 'wETH',
						symbol: 'wETH',
						address: OPT_WETH_TOKEN_ADDRESS,
						chainID: props.currentVault.chainID,
						decimals: 18
					})
				]
			);
		} else {
			payloadFrom.push(
				setZapOption({
					name: props.currentVault?.token?.name,
					symbol: props.currentVault?.token?.symbol,
					address: toAddress(props.currentVault.token.address),
					chainID:
						props.currentVault?.chainID === 1337 ? props.currentVault.chainID : props.currentVault?.chainID,
					decimals: props.currentVault?.token?.decimals || 18
				})
			);
			payloadTo.push(
				setZapOption({
					name: props.currentVault?.name,
					symbol: props.currentVault?.symbol,
					address: toAddress(props.currentVault.address),
					chainID:
						props.currentVault?.chainID === 1337 ? props.currentVault.chainID : props.currentVault?.chainID,
					decimals: props.currentVault?.decimals || 18
				})
			);
		}

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Init selectedFrom and selectedTo as default, aka underlyingToken to vaultToken.
		 ******************************************************************************************/
		const _selectedFrom = setZapOption({
			name: props.currentVault?.token?.name,
			symbol: props.currentVault?.token?.symbol,
			address: toAddress(props.currentVault.token.address),
			chainID: props.currentVault?.chainID === 1337 ? props.currentVault.chainID : props.currentVault?.chainID,
			decimals: props.currentVault?.token?.decimals || 18
		});
		const _selectedTo = setZapOption({
			name: props.currentVault?.name,
			symbol: props.currentVault.symbol,
			address: toAddress(props.currentVault.address),
			chainID: props.currentVault?.chainID === 1337 ? props.currentVault.chainID : props.currentVault?.chainID,
			decimals: props.currentVault?.decimals || 18
		});

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Update the possibleOptions local state and the actionParams global state.
		 ******************************************************************************************/
		set_possibleOptionsFrom(payloadFrom);
		set_possibleOptionsTo(payloadTo);
		if (!isDepositing) {
			actionParamsDispatcher({
				type: 'options',
				payload: {
					selectedOptionFrom: _selectedTo,
					selectedOptionTo: _selectedFrom,
					possibleOptionsFrom: payloadTo,
					possibleOptionsTo: payloadFrom
				}
			});
		} else {
			actionParamsDispatcher({
				type: 'options',
				payload: {
					selectedOptionFrom: _selectedFrom,
					selectedOptionTo: _selectedTo,
					possibleOptionsFrom: payloadFrom,
					possibleOptionsTo: payloadTo
				}
			});
		}
	});

	/**********************************************************************************************
	 ** FLOW: Init the possibleZapOptionsFrom array.
	 **
	 ** This array will be used to populate the dropdown list of tokens to deposit via the zap
	 ** feature.
	 ** The WETH/WFTM token is not included in the list if the vault is already using WETH/WFTM.
	 ** The underlying token is not included in the list if the vault is already using it.
	 ** The vault token is not included in the list because this has no sense.
	 **********************************************************************************************/
	useEffect((): void => {
		const _possibleZapOptionsFrom: TDropdownOption[] = [];
		const isWithWETH =
			props.currentVault.chainID === 1 && toAddress(props.currentVault?.token?.address) === WETH_TOKEN_ADDRESS;
		const isWithWOPT =
			props.currentVault.chainID === 10 &&
			toAddress(props.currentVault?.token?.address) === OPT_WETH_TOKEN_ADDRESS;
		const isWithWFTM =
			props.currentVault.chainID === 250 && toAddress(props.currentVault?.token?.address) === WFTM_TOKEN_ADDRESS;

		Object.values(tokenLists?.[props.currentVault.chainID] || []).forEach((tokenData): void => {
			const duplicateAddresses = [
				isWithWETH ? WETH_TOKEN_ADDRESS : null,
				isWithWFTM ? WFTM_TOKEN_ADDRESS : null,
				isWithWOPT ? ETH_TOKEN_ADDRESS : null,
				isWithWOPT ? OPT_WETH_TOKEN_ADDRESS : null,
				toAddress(props.currentVault?.token?.address),
				toAddress(props.currentVault?.address)
			].filter(Boolean);

			if (duplicateAddresses.includes(toAddress(tokenData.address))) {
				return; // Do nothing to avoid duplicate token in the list
			}
			if (getBalance({address: toAddress(tokenData.address), chainID: tokenData.chainID}).raw === 0n) {
				return; // Do nothing to avoid empty token in the list
			}
			if (toAddress(tokenData.address) === toAddress(props.currentVault.token.address)) {
				return; // Do nothing to avoid the underlying token in the list
			}

			_possibleZapOptionsFrom.push(
				setZapOption({
					name: tokenData.name,
					symbol: tokenData.symbol,
					address: toAddress(tokenData.address),
					chainID: tokenData.chainID,
					decimals: tokenData.decimals,
					solveVia:
						tokenData.chainID === 1 && !isEthAddress(tokenData.address)
							? ['Portals', 'Cowswap']
							: ['Portals']
				})
			);
		});
		_possibleZapOptionsFrom.sort((a, b): number => {
			const aBalance = getBalance({address: toAddress(a.value), chainID: props.currentVault.chainID}).normalized;
			const bBalance = getBalance({address: toAddress(b.value), chainID: props.currentVault.chainID}).normalized;
			return bBalance - aBalance;
		});
		set_possibleZapOptionsFrom([
			setZapOption({
				name: props.currentVault.token.name,
				symbol: props.currentVault.token.symbol,
				address: toAddress(props.currentVault.token.address),
				chainID: props.currentVault.chainID,
				decimals: props.currentVault.token.decimals,
				solveVia: ['Vanilla']
			}),
			..._possibleZapOptionsFrom
		]);
		currentTokenListIdentifier;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.currentVault.chainID, tokenLists, currentTokenListIdentifier, props.currentVault]);

	/**********************************************************************************************
	 ** FLOW: Init the possibleZapOptionsTo array.
	 **
	 ** This array will be used to populate the dropdown list of tokens to withdraw via the zap
	 ** feature.
	 ** This list is always the same, and is not dependent on the vault.
	 **********************************************************************************************/
	useEffect((): void => {
		const _possibleZapOptionsTo: TDropdownOption[] = [];

		externalzapOutTokenList
			.filter((): boolean => props.currentVault.chainID === props.currentVault?.chainID) // Disable if we are on the wrong chain
			.filter((token): boolean => token.chainID === (props.currentVault?.chainID || props.currentVault.chainID))
			.forEach((tokenListData): void => {
				_possibleZapOptionsTo.push(
					setZapOption({
						name: tokenListData?.name,
						symbol: tokenListData?.symbol,
						address: toAddress(tokenListData?.address),
						chainID:
							props.currentVault?.chainID === 1337
								? props.currentVault.chainID
								: props.currentVault?.chainID,
						decimals: tokenListData?.decimals,
						solveVia: (tokenListData?.supportedZaps as TSolver[]) || []
					})
				);
			});
		set_possibleZapOptionsTo(_possibleZapOptionsTo);
	}, [props.currentVault.chainID]);

	const cleanPossibleOptionsFrom = useMemo((): TDropdownOption[] => {
		const uniqueTokens: TDropdownOption[] = [];
		const allOptions = [...actionParams.possibleOptionsFrom, ...possibleZapOptionsFrom];
		allOptions.forEach((option): void => {
			if (isZeroAddress(option.value)) {
				return;
			}
			if (toAddress(option.value) === '0x0000000000000000000000000000000000001010') {
				return; // Matic as ERC20
			}
			const isDuplicate = uniqueTokens.some((uniqueOption): boolean => uniqueOption.value === option.value);
			if (!isDuplicate) {
				uniqueTokens.push(option);
			}
		});
		return uniqueTokens;
	}, [actionParams.possibleOptionsFrom, possibleZapOptionsFrom]);

	/**********************************************************************************************
	 ** FLOW: Store the value from that context in a Memoized variable to avoid useless re-renders
	 **********************************************************************************************/
	const contextValue = useMemo(
		(): TActionFlowContext => ({
			currentVault: props.currentVault,
			possibleOptionsFrom: cleanPossibleOptionsFrom,
			possibleOptionsTo: [...actionParams.possibleOptionsTo, ...possibleZapOptionsTo],
			actionParams,
			onChangeAmount,
			onUpdateSelectedOptionFrom: (newSelectedOptionFrom: TDropdownOption): void => {
				updateParams(newSelectedOptionFrom, actionParams?.selectedOptionTo as TDropdownOption);
			},
			onUpdateSelectedOptionTo: (newSelectedOptionTo: TDropdownOption): void => {
				updateParams(actionParams?.selectedOptionFrom as TDropdownOption, newSelectedOptionTo);
			},
			onSwitchSelectedOptions,
			isDepositing,
			maxDepositPossible,
			maxWithdrawPossible,
			currentSolver,
			veYFIBalance: toNormalizedBN(veYFIBalance, 18),
			hasVeYFIBalance
		}),
		[
			props.currentVault,
			cleanPossibleOptionsFrom,
			actionParams,
			possibleZapOptionsTo,
			onChangeAmount,
			onSwitchSelectedOptions,
			isDepositing,
			maxDepositPossible,
			maxWithdrawPossible,
			currentSolver,
			veYFIBalance,
			hasVeYFIBalance,
			updateParams
		]
	);

	return <ActionFlowContext.Provider value={contextValue}>{props.children}</ActionFlowContext.Provider>;
}

export const useActionFlow = (): TActionFlowContext => useContext(ActionFlowContext);
