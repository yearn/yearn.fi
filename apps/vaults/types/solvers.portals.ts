export type TPortalsQuoteResult = {
	result: TPortalEstimation | undefined;
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

export type TPortalTransaction = {
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
}

export type TPortalEstimation = {
	buyToken: string;
	buyAmount: string;
	minBuyAmount: string;
	buyTokenDecimals: number;
}
