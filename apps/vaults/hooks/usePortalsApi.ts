import {useState} from 'react';
import axios from 'axios';

import type {AxiosInstance, AxiosResponse} from 'axios';

export type TPortalEstimate = {
	buyToken: string;
	buyAmount: string;
	minBuyAmount: string;
	buyTokenDecimals: number;
};

type TGetEstimateProps = {
	network: number;
	params: {
		sellToken: string;
		sellAmount: string;
		buyToken: string;
		slippagePercentage: string;
	};
};

type TGetTransactionProps = Omit<TGetEstimateProps, 'params'> & {
	params: Required<Pick<TGetEstimateProps, 'params'>['params']> & {
		takerAddress: string;
	};
};

type TGetApprovalProps = Omit<TGetTransactionProps, 'params'> & {
	params: Omit<TGetTransactionProps['params'], 'slippagePercentage'>;
};

type TPortalTransaction = {
	context: {
		network: string;
		protocolId: string;
		sellToken: string;
		sellAmount: string;
		intermediateToken: string;
		buyToken: string;
		buyAmount: string;
		minBuyAmount: string;
		target: string;
		partner: string;
		takerAddress: string;
		value: string;
		gasLimit: string;
	};
	tx: {
		to: string;
		from: string;
		data: string;
		value: {
			type: string;
			hex: string;
		};
		gasLimit: {
			type: string;
			hex: string;
		};
	};
};

type TPortalsApproval = {
	context: {
		network: string;
		allowance: string;
		approvalAmount: string;
		shouldApprove: boolean;
		spender: string;
		gasLimit: string;
	};
	tx: {
		to: string;
		from: string;
		data: string;
		value: {
			type: string;
			hex: string;
		};
		gasLimit: {
			type: string;
			hex: string;
		};
	};
};

const NETWORK = new Map<number, string>([
	[1, 'ethereum'],
	[10, 'optimism'],
	[250, 'fantom'],
	[42161, 'arbitrum'],
	[137, 'polygon'],
	[43114, 'avalanche'],
	[56, 'bsc']
]);

type TUsePortalsApi = {
	getEstimate: (props: TGetEstimateProps) => Promise<TPortalEstimate | null>;
	getTransaction: (
		props: TGetTransactionProps
	) => Promise<TPortalTransaction | null>;
	getApproval: (props: TGetApprovalProps) => Promise<TPortalsApproval | null>;
	error: unknown;
};

const usePortalsApi = (): TUsePortalsApi => {
	const [error, set_error] = useState<unknown | null>(null);

	const baseURL = 'https://api.portals.fi/v1';
	const axiosInstance: AxiosInstance = axios.create({baseURL});

	const getEstimate = async ({
		network,
		params
	}: TGetEstimateProps): Promise<TPortalEstimate | null> => {
		try {
			const endpoint = `/portal/${NETWORK.get(network)}/estimate`;
			const response: AxiosResponse<TPortalEstimate> =
				await axiosInstance.get(endpoint, {params});
			return response.data;
		} catch (err) {
			set_error(err);
			return null;
		}
	};

	const getTransaction = async ({
		network,
		params
	}: TGetTransactionProps): Promise<TPortalTransaction | null> => {
		try {
			const endpoint = `/portal/${NETWORK.get(network)}`;
			const response: AxiosResponse<TPortalTransaction> =
				await axiosInstance.get(endpoint, {params});
			return response.data;
		} catch (err) {
			set_error(err);
			return null;
		}
	};

	const getApproval = async ({
		network,
		params
	}: TGetApprovalProps): Promise<TPortalsApproval | null> => {
		try {
			const endpoint = `/approval/${NETWORK.get(network)}`;
			const response: AxiosResponse<TPortalsApproval> =
				await axiosInstance.get(endpoint, {params});
			return response.data;
		} catch (err) {
			set_error(err);
			return null;
		}
	};

	return {getEstimate, getTransaction, getApproval, error};
};

export default usePortalsApi;
