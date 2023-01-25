import {useCallback} from 'react';
import {Contract} from 'ethcall';
import {BigNumber, ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export type TUserInfo = {
	balance: BigNumber;
	votesSpent: BigNumber;
	lastVoteTime: number;
}

type TVoteTxProps = {
	provider: ethers.providers.Web3Provider;
	votes?: BigNumber;
	gaugeAddress: TAddress;
}

type TTransactionProps = {
	provider: ethers.providers.Web3Provider;
	amount: BigNumber;
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
	deposit: (props: TTransactionProps) => Promise<boolean>;
	withdraw: (props: TTransactionProps) => Promise<boolean>;
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

const VL_YCRV_CONTRACT = toAddress('0xCCBD4579495cD78280e4900CB482C8Edf2EC8336');

async function deposit({provider, amount}: TTransactionProps): Promise<boolean> {
	const signer = provider.getSigner();

	try {
		const contract = new ethers.Contract(VL_YCRV_CONTRACT, VLYCRV_ABI, signer);
		const transaction = await contract.deposit(amount);
		const transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			throw new Error('Fail to perform transaction');
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}

async function withdraw({provider, amount}: TTransactionProps): Promise<boolean> {
	const signer = provider.getSigner();

	try {
		const contract = new ethers.Contract(VL_YCRV_CONTRACT, VLYCRV_ABI, signer);
		const transaction = await contract.withdraw(amount);
		const transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			throw new Error('Fail to perform transaction');
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}

async function vote({provider, gaugeAddress, votes}: TVoteTxProps): Promise<boolean> {
	const signer = provider.getSigner();

	try {
		const contract = new ethers.Contract(VL_YCRV_CONTRACT, VLYCRV_ABI, signer);
		const transaction = await contract.vote(gaugeAddress, votes);
		const transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			throw new Error('Fail to perform transaction');
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}

export function useVLyCRV(): TUseVLyCRV {
	const {provider, isActive, address} = useWeb3();
    
	const fetcher = useCallback(async (): Promise<TUseVLyCRV['initialData']> => {
		if (!isActive || !provider) {
			return DEFAULT_VLYCRV;
		}

		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VL_YCRV_CONTRACT, VLYCRV_ABI);

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

	return {initialData: data ?? DEFAULT_VLYCRV, deposit, withdraw, vote};
}
