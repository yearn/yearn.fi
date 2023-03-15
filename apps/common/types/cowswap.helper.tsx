/* eslint-disable @typescript-eslint/naming-convention */
import type {BytesLike, Signer, TypedDataEncoder, VoidSigner} from 'ethers';
import type {TBigNumberish} from '@yearn-finance/web-lib/types';

/* 🔵 - Yearn Finance ******************************************************
**	Cowswap code duplication for ORDERS
**	We need to copy the Cowswap Order type to be able to use it in our code
**	as ethers6 is currently not supported by the package.
**	Source: https://github.com/cowprotocol/contracts/blob/7efd5b43fbf46fe40bac9e6de1b6bab05d27c20b/src/ts/order.ts
***************************************************************************/
export type Timestamp = number | Date;
export type HashLike = BytesLike | number;
export enum OrderKind {
	SELL = 'sell',
	BUY = 'buy'
}
export enum OrderBalance {
	ERC20 = 'erc20',
	EXTERNAL = 'external',
	INTERNAL = 'internal'
}
export type Order = {
	sellToken: string;
	buyToken: string;
	receiver?: string;
	sellAmount: TBigNumberish;
	buyAmount: TBigNumberish;
	validTo: Timestamp;
	appData: HashLike;
	feeAmount: TBigNumberish;
	kind: OrderKind;
	partiallyFillable: boolean;
	sellTokenBalance?: OrderBalance;
	buyTokenBalance?: OrderBalance;
}
export type NormalizedOrder = Omit<Order, 'validTo' | 'appData' | 'kind' | 'sellTokenBalance' | 'buyTokenBalance'> & {
	receiver: string;
	validTo: number;
	appData: string;
	kind: 'sell' | 'buy';
	sellTokenBalance: 'erc20' | 'external' | 'internal';
	buyTokenBalance: 'erc20' | 'internal';
};

/* 🔵 - Yearn Finance ******************************************************
**	Cowswap code duplication for ERRORS
**	We need to copy the Cowswap Order type to be able to use it in our code
**	as ethers6 is currently not supported by the package.
**	Source: https://github.com/cowprotocol/contracts/blob/7efd5b43fbf46fe40bac9e6de1b6bab05d27c20b/src/ts/api.ts#L95
***************************************************************************/
export type ApiError = {
	errorType: string;
	description: string;
}

/* 🔵 - Yearn Finance ******************************************************
**	Cowswap code duplication for QUOTES
**	We need to copy the Cowswap Order type to be able to use it in our code
**	as ethers6 is currently not supported by the package.
**	Source: https://github.com/cowprotocol/contracts/blob/7efd5b43fbf46fe40bac9e6de1b6bab05d27c20b/src/ts/api.ts#L67
***************************************************************************/
export type SellAmountBeforeFee = {
	kind: OrderKind.SELL;
	sellAmountBeforeFee: TBigNumberish;
};

export type SellAmountAfterFee = {
	kind: OrderKind.SELL;
	sellAmountAfterFee: TBigNumberish;
};

export type BuyAmountAfterFee = {
	kind: OrderKind.BUY;
	buyAmountAfterFee: TBigNumberish;
};

export type QuoteQuery = CommonQuoteQuery &
(SellAmountBeforeFee | SellAmountAfterFee | BuyAmountAfterFee);

export enum QuotePriceQuality {
	FAST = 'fast',
	OPTIMAL = 'optimal'
}

export type CommonQuoteQuery = {
	sellToken: string;
	buyToken: string;
	receiver?: string;
	validTo?: Timestamp;
	appData?: HashLike;
	partiallyFillable?: boolean;
	sellTokenBalance?: OrderBalance;
	buyTokenBalance?: OrderBalance;
	from: string;
	priceQuality?: QuotePriceQuality;
}

/* 🔵 - Yearn Finance ******************************************************
**	Cowswap code duplication for SIGN
**	We need to copy the Cowswap Order type to be able to use it in our code
**	as ethers6 is currently not supported by the package.
**	Source: https://github.com/cowprotocol/contracts/blob/7efd5b43fbf46fe40bac9e6de1b6bab05d27c20b/src/ts/sign.ts#L36
***************************************************************************/
export enum SigningScheme {
	EIP712 = 0b00,
	ETHSIGN = 0b01,
	EIP1271 = 0b10,
	PRESIGN = 0b11
}
export type EcdsaSigningScheme = SigningScheme.EIP712 | SigningScheme.ETHSIGN;
export type EcdsaSignature = {
	scheme: EcdsaSigningScheme;
	data: string;
}
export type TypedDataSigner = {_signTypedData: typeof VoidSigner.prototype.signTypedData} & Signer
export type TypedDataDomain = Parameters<typeof TypedDataEncoder.hashDomain>[0];
export type TypedDataTypes = Parameters<typeof TypedDataEncoder.hashStruct>[1];

