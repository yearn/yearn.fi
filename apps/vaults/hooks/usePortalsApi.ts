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
		validate?: boolean;
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

type TPortalsEstimateResp = {
	data: TPortalEstimate | undefined,
	error?: Error | undefined
}
export async function getPortalsEstimate({network, params}: TGetEstimateProps): Promise<TPortalsEstimateResp> {
	const baseURL = 'https://api.portals.fi/v1';
	const axiosInstance: AxiosInstance = axios.create({baseURL});

	try {
		const path = `/portal/${NETWORK.get(network)}/estimate`;
		const response: AxiosResponse<TPortalEstimate> = await axiosInstance.get(path, {params});
		return {data: response.data};
	} catch (err) {
		return {data: undefined, error: err as Error};
	}
}

export async function getPortalsTx({network, params}: TGetTransactionProps): Promise<TPortalTransaction> {
	const baseURL = 'https://api.portals.fi/v1';
	const axiosInstance: AxiosInstance = axios.create({baseURL});

	const path = `/portal/${NETWORK.get(network)}`;
	const response: AxiosResponse<TPortalTransaction> = await axiosInstance.get(path, {params});
	return response.data;
}


export async function getPortalsApproval({network, params}: TGetApprovalProps): Promise<TPortalsApproval> {
	const baseURL = 'https://api.portals.fi/v1';
	const axiosInstance: AxiosInstance = axios.create({baseURL});

	const path = `/approval/${NETWORK.get(network)}`;
	const response: AxiosResponse<TPortalsApproval> = await axiosInstance.get(path, {params});
	return response.data;
}
