import {useCallback} from 'react';
import {Contract} from 'ethcall';
import {BigNumber} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {VLYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';
import {vLyCRVDeposit} from '@yCRV/utils/actions/vLyCRVDeposit';
import {vLyCRVVote} from '@yCRV/utils/actions/vLyCRVVote';
import {vLyCRVWithdraw} from '@yCRV/utils/actions/vLyCRVWithdraw';

import type {TVlyCRVDepositProps, TVlyCRVWithdrawProps, TVoteTxProps} from '@yCRV/utils/actions/types';

export type TUserInfo = {
	balance: BigNumber;
	votesSpent: BigNumber;
	lastVoteTime: number;
}

type TGetVotesUnpacked = {
	gaugesList: string[];
	voteAmounts: BigNumber[];
}

type TUseVLyCRV = {
	initialData: {
		nextPeriod: number;
		userInfo: TUserInfo;
		getVotesUnpacked: TGetVotesUnpacked;
	};
	vote: (props: TVoteTxProps) => Promise<boolean>;
	deposit: (props: TVlyCRVDepositProps) => Promise<boolean>;
	withdraw: (props: TVlyCRVWithdrawProps) => Promise<boolean>;
};

const DEFAULT_VLYCRV = {
	nextPeriod: 0,
	userInfo: {
		balance: BigNumber.from(0),
		votesSpent: BigNumber.from(0),
		lastVoteTime: 0
	},
	getVotesUnpacked: {
		gaugesList: [],
		voteAmounts: []
	}
};

export function useVLyCRV(): TUseVLyCRV {
	const {provider, isActive, address} = useWeb3();
    
	const fetcher = useCallback(async (): Promise<TUseVLyCRV['initialData']> => {
		if (!isActive || !provider) {
			return DEFAULT_VLYCRV;
		}

		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI);

		const [
			nextPeriod,
			userInfo,
			getVotesUnpacked
		] = await ethcallProvider.tryAll([
			vLyCRVContract.nextPeriod(),
			vLyCRVContract.userInfo(address),
			vLyCRVContract.getVotesUnpacked()
		]) as [number, TUserInfo, TGetVotesUnpacked];

		return {nextPeriod, userInfo, getVotesUnpacked};
	}, [address, isActive, provider]);

	const {data} = useSWR<TUseVLyCRV['initialData']>(isActive && provider ? 'vLyCRV' : null, fetcher);

	return {
		initialData: data ?? DEFAULT_VLYCRV,
		deposit: vLyCRVDeposit,
		withdraw: vLyCRVWithdraw,
		vote: vLyCRVVote
	};
}
