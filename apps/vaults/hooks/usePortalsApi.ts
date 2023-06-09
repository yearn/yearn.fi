import {z} from 'zod';
import {useFetch} from '@common/hooks/useFetch';

export const portalsEstimateResponseSchema = z.object({
	buyToken: z.string(),
	buyAmount: z.string(),
	minBuyAmount: z.string(),
	buyTokenDecimals: z.number()
});

export type TPortalsEstimateResponse = z.infer<typeof portalsEstimateResponseSchema>;

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
		validate?: string;
	};
};

const portalsTxSchema = z.object({
	to: z.string(),
	from: z.string(),
	data: z.string(),
	value: z.object({
		type: z.string(),
		hex: z.string()
	}),
	gasLimit: z.object({
		type: z.string(),
		hex: z.string()
	})
});

const portalsTransactionSchema = z.object({
	context: z.object({
		network: z.string(),
		protocolId: z.string(),
		sellToken: z.string(),
		sellAmount: z.string(),
		intermediateToken: z.string(),
		buyToken: z.string(),
		buyAmount: z.string(),
		minBuyAmount: z.string(),
		target: z.string(),
		partner: z.string(),
		takerAddress: z.string(),
		value: z.string(),
		gasLimit: z.string()
	}),
	tx: portalsTxSchema
});

export type TPortalsTransaction = z.infer<typeof portalsTransactionSchema>;

type TGetApprovalProps = Omit<TGetTransactionProps, 'params'> & {
	params: Omit<TGetTransactionProps['params'], 'slippagePercentage'>;
};

const portalsApprovalSchema = z.object({
	context: z.object({
		network: z.string(),
		allowance: z.string(),
		approvalAmount: z.string(),
		shouldApprove: z.boolean(),
		spender: z.string(),
		gasLimit: z.string()
	}),
	tx: portalsTxSchema
});

export type TPortalsApproval = z.infer<typeof portalsApprovalSchema>;

const NETWORK = new Map<number, string>([
	[1, 'ethereum'],
	[10, 'optimism'],
	[250, 'fantom'],
	[42161, 'arbitrum'],
	[137, 'polygon'],
	[43114, 'avalanche'],
	[56, 'bsc']
]);


const BASE_URL = 'https://api.portals.fi/v1';

export async function useGetPortalsEstimate({network, params}: TGetEstimateProps): Promise<TPortalsEstimateResponse | null> {
	const url = `${BASE_URL}/portal/${NETWORK.get(network)}/estimate`;

	const {data} = useFetch<TPortalsEstimateResponse>({
		endpoint: `${url}?${new URLSearchParams(params)}`,
		schema: portalsEstimateResponseSchema
	});

	return data ?? null;
}

export async function useGetPortalsTx({network, params}: TGetTransactionProps): Promise<TPortalsTransaction | null> {
	const url = `${BASE_URL}/portal/${NETWORK.get(network)}`;

	const {data} = useFetch<TPortalsTransaction>({
		endpoint: `${url}?${new URLSearchParams(params)}`,
		schema: portalsTransactionSchema
	});

	return data ?? null;
}

export async function useGetPortalsApproval({network, params}: TGetApprovalProps): Promise<TPortalsApproval | null> {
	const url = `${BASE_URL}/approval/${NETWORK.get(network)}`;

	const {data} = useFetch<TPortalsApproval>({
		endpoint: `${url}?${new URLSearchParams(params)}`,
		schema: portalsApprovalSchema
	});

	return data ?? null;
}
