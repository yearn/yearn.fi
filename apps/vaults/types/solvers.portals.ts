export type TPortalsAPIResult = {
	buyToken: string;
	buyAmount: string;
	minBuyAmount: string;
	buyTokenDecimals: 0;
};

export type TPortalsResult = {
	result: TPortalsAPIResult | undefined;
	isLoading: boolean;
	error: Error | undefined;
};

export type TPortalsApproval = {
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
