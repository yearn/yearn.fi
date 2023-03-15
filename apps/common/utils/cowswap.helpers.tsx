import {ethers} from 'ethers';
import {addressZero} from '@yearn-finance/web-lib/utils/address';
import {OrderBalance, SigningScheme} from '@common/types/cowswap.helper';

import type {Signer} from 'ethers';
import type {EcdsaSignature, EcdsaSigningScheme, HashLike, NormalizedOrder, Order, Timestamp, TypedDataDomain, TypedDataSigner, TypedDataTypes} from '@common/types/cowswap.helper';


/* 🔵 - Yearn Finance ******************************************************
**	Cowswap code duplication
**	We need to copy the Cowswap Order type to be able to use it in our code
**	as ethers6 is currently not supported by the package.
**	Source: https://github.com/cowprotocol/contracts/blob/7efd5b43fbf46fe40bac9e6de1b6bab05d27c20b/src/ts/index.ts#L1
***************************************************************************/
export const ORDER_TYPE_FIELDS = [
	{name: 'sellToken', type: 'address'},
	{name: 'buyToken', type: 'address'},
	{name: 'receiver', type: 'address'},
	{name: 'sellAmount', type: 'uint256'},
	{name: 'buyAmount', type: 'uint256'},
	{name: 'validTo', type: 'uint32'},
	{name: 'appData', type: 'bytes32'},
	{name: 'feeAmount', type: 'uint256'},
	{name: 'kind', type: 'string'},
	{name: 'partiallyFillable', type: 'bool'},
	{name: 'sellTokenBalance', type: 'string'},
	{name: 'buyTokenBalance', type: 'string'}
];

/**
 * Return the Gnosis Protocol v2 domain used for signing.
 * @param chainId The EIP-155 chain ID.
 * @param verifyingContract The address of the contract that will verify the
 * signature.
 * @return An EIP-712 compatible typed domain data.
 */
export function domain(
	chainId: number,
	verifyingContract: string
): TypedDataDomain {
	return {
		name: 'Gnosis Protocol',
		version: 'v2',
		chainId,
		verifyingContract
	};
}


function isTypedDataSigner(signer: Signer): signer is TypedDataSigner {
	return '_signTypedData' in signer;
}
function timestamp(t: Timestamp): number {
	return typeof t === 'number' ? t : ~~(t.getTime() / 1000);
}
export function hashify(h: HashLike): string {
	return typeof h === 'number' ? `0x${h.toString(16).padStart(64, '0')}` : ethers.zeroPadValue(h, 32);
}
function hashTypedData(
	domain: TypedDataDomain,
	types: TypedDataTypes,
	data: {[key: string]: unknown}
): string {
	return ethers.TypedDataEncoder.hash(domain, types, data);
}

async function ecdsaSignTypedData(
	scheme: EcdsaSigningScheme,
	owner: Signer,
	domain: TypedDataDomain,
	types: TypedDataTypes,
	data: { [key: string]: unknown }
): Promise<string> {
	let signature: string | null = null;

	switch (scheme) {
		case SigningScheme.EIP712:
			if (!isTypedDataSigner(owner)) {
				throw new Error('signer does not support signing typed data');
			}
			signature = await owner._signTypedData(domain, types, data);
			break;
		case SigningScheme.ETHSIGN:
			signature = await owner.signMessage(
				ethers.getBytes(hashTypedData(domain, types, data))
			);
			break;
		default:
			throw new Error('invalid signing scheme');
	}

	// Passing the signature through split/join to normalize the `v` byte.
	// Some wallets do not pad it with `27`, which causes a signature failure
	// `splitSignature` pads it if needed, and `joinSignature` simply puts it back together
	return ethers.Signature.from(ethers.Signature.from(signature)).serialized;
}


/**
 * Normalizes the balance configuration for a buy token. Specifically, this
 * function ensures that {@link OrderBalance.EXTERNAL} gets normalized to
 * {@link OrderBalance.ERC20}.
 *
 * @param balance The balance configuration.
 * @returns The normalized balance configuration.
 */
export function normalizeBuyTokenBalance(
	balance: OrderBalance | undefined
): OrderBalance.ERC20 | OrderBalance.INTERNAL {
	switch (balance) {
		case undefined:
		case OrderBalance.ERC20:
		case OrderBalance.EXTERNAL:
			return OrderBalance.ERC20;
		case OrderBalance.INTERNAL:
			return OrderBalance.INTERNAL;
		default:
			throw new Error(`invalid order balance ${balance}`);
	}
}

/**
 * Normalizes an order for hashing and signing, so that it can be used with
 * Ethers.js for EIP-712 operations.
 * @param hashLike A hash-like value to normalize.
 * @returns A 32-byte hash encoded as a hex-string.
 */
export function normalizeOrder(order: Order): NormalizedOrder {
	if (order.receiver === addressZero) {
		throw new Error('receiver cannot be address(0)');
	}

	const normalizedOrder = {
		...order,
		sellTokenBalance: order.sellTokenBalance ?? OrderBalance.ERC20,
		receiver: order.receiver ?? addressZero,
		validTo: timestamp(order.validTo),
		appData: hashify(order.appData),
		buyTokenBalance: normalizeBuyTokenBalance(order.buyTokenBalance)
	};
	return normalizedOrder;
}

/**
 * Returns the signature for the specified order with the signing scheme encoded
 * into the signature.
 *
 * @param domain The domain to sign the order for. This is used by the smart
 * contract to ensure orders can't be replayed across different applications,
 * but also different deployments (as the contract chain ID and address are
 * mixed into to the domain value).
 * @param order The order to sign.
 * @param owner The owner for the order used to sign.
 * @param scheme The signing scheme to use. See {@link SigningScheme} for more
 * details.
 * @return Encoded signature including signing scheme for the order.
 */
export async function signOrder(
	domain: TypedDataDomain,
	order: Order,
	owner: Signer,
	scheme: EcdsaSigningScheme
): Promise<EcdsaSignature> {
	return {
		scheme,
		data: await ecdsaSignTypedData(
			scheme,
			owner,
			domain,
			{Order: ORDER_TYPE_FIELDS},
			normalizeOrder(order)
		)
	};
}
