import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useContractRead, useContractReads} from 'wagmi';
import VEYFI_ABI from '@veYFI/utils/abi/veYFI.abi';
import VEYFI_POSITION_HELPER_ABI from '@veYFI/utils/abi/veYFIPositionHelper.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey, isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {VEYFI_ADDRESS, VEYFI_POSITION_HELPER_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toMilliseconds} from '@yearn-finance/web-lib/utils/time';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

export type TVotingEscrow = {
	address: TAddress,
	token: TAddress,
	name: string,
	symbol: string,
	decimals: number,
	supply: bigint,
	rewardPool: TAddress,
}

export type TPosition = {
	balance: bigint,
	underlyingBalance: bigint,
}

export type TVotingEscrowPosition = {
	deposit?: TPosition,
	unlockTime?: TMilliseconds,
	penalty?: bigint,
	penaltyRatio?: number,
	withdrawable?: bigint,
}

export type	TVotingEscrowContext = {
	votingEscrow: TVotingEscrow | undefined,
	positions: TVotingEscrowPosition | undefined,
	allowances: TDict<bigint>,
	isLoading: boolean,
	refresh: VoidFunction,
}
const defaultProps: TVotingEscrowContext = {
	votingEscrow: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const VotingEscrowContext = createContext<TVotingEscrowContext>(defaultProps);
export const VotingEscrowContextApp = memo(function VotingEscrowContextApp({children}: {children: ReactElement}): ReactElement {
	const {address, isActive} = useWeb3();

	/* 🔵 - Yearn Finance **********************************************************
	** Retrieving the basic information of the veYFI contract. They are not linked
	** to the user's address, so they are not affected by the `isActive` flag.
	******************************************************************************/
	const baseVeYFIContract = {address: VEYFI_ADDRESS, abi: VEYFI_ABI};
	const {data: votingEscrowData, status: votingEscrowStatus, refetch: refreshVotingEscrow} = useContractReads({
		contracts: [
			{...baseVeYFIContract, functionName: 'token'},
			{...baseVeYFIContract, functionName: 'name'},
			{...baseVeYFIContract, functionName: 'symbol'},
			{...baseVeYFIContract, functionName: 'decimals'},
			{...baseVeYFIContract, functionName: 'supply'},
			{...baseVeYFIContract, functionName: 'reward_pool'}
		]
	});
	const votingEscrow = useMemo((): TVotingEscrow | undefined => {
		if (!votingEscrowData || votingEscrowStatus !== 'success') {
			return undefined;
		}
		const [token, name, symbol, decimals, supply, rewardPool] = votingEscrowData;
		return ({
			address: VEYFI_ADDRESS,
			token: toAddress(decodeAsString(token)),
			name: decodeAsString(name),
			symbol: decodeAsString(symbol),
			decimals: decodeAsNumber(decimals) || Number(decodeAsBigInt(decimals)),
			supply: decodeAsBigInt(supply),
			rewardPool: toAddress(decodeAsString(rewardPool))
		});
	}, [votingEscrowData, votingEscrowStatus]);


	/* 🔵 - Yearn Finance **********************************************************
	** Retrieving the user's positions in the veYFI contract. They are linked to the
	** user's address, so they are affected by the `isActive` flag.
	******************************************************************************/
	const baseVeYFIPositionContract = {address: VEYFI_POSITION_HELPER_ADDRESS, abi: VEYFI_POSITION_HELPER_ABI};
	const {data: positionData, status: positionStatus, refetch: refreshPosition} = useContractRead({
		...baseVeYFIPositionContract,
		functionName: 'getPositionDetails',
		args: [toAddress(address)],
		enabled: isActive && address !== undefined && !isZeroAddress(address)
	});
	const positions = useMemo((): TVotingEscrowPosition | undefined => {
		if (!positionData || positionStatus !== 'success') {
			return undefined;
		}
		const {balance, depositAmount, withdrawable, penalty, unlockTime} = positionData;
		const depositPosition: TPosition = {
			balance: balance,
			underlyingBalance: depositAmount
		};
		return {
			deposit: depositPosition,
			unlockTime: toMilliseconds(Number(unlockTime)),
			penalty: penalty,
			penaltyRatio: depositAmount > 0 ? Number(penalty) / Number(depositAmount) : 0,
			withdrawable: withdrawable
		};
	}, [positionData, positionStatus]);


	/* 🔵 - Yearn Finance **********************************************************
	** Retrieving the user's allowances of YFI for the veYFI contract.
	******************************************************************************/
	const baseYFIContract = {address: YFI_ADDRESS, abi: ERC20_ABI};
	const {data: allowance, status: allowanceStatus, refetch: refreshAllowance} = useContractRead({
		...baseYFIContract,
		functionName: 'allowance',
		args: [toAddress(address), VEYFI_ADDRESS],
		enabled: isActive && address !== undefined && !isZeroAddress(address)
	});
	const allowances = useMemo((): TDict<bigint> => {
		if (!address || !allowance || allowanceStatus !== 'success') {
			return {};
		}
		return ({
			[allowanceKey(1, YFI_ADDRESS, VEYFI_ADDRESS, address)]: allowance
		});
	}, [address, allowance, allowanceStatus]);

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPosition();
		refreshAllowance();
	}, [refreshVotingEscrow, refreshPosition, refreshAllowance]);

	const contextValue = useMemo((): TVotingEscrowContext => ({
		votingEscrow,
		positions,
		allowances: allowances ?? {},
		isLoading: votingEscrowStatus === 'loading' && positionStatus === 'loading' && allowanceStatus === 'loading',
		refresh
	}), [votingEscrow, positions, allowances, votingEscrowStatus, positionStatus, allowanceStatus, refresh]);

	return (
		<VotingEscrowContext.Provider value={contextValue}>
			{children}
		</VotingEscrowContext.Provider>
	);
});

export const useVotingEscrow = (): TVotingEscrowContext => useContext(VotingEscrowContext);
export default useVotingEscrow;
