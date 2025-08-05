import { getAddress, zeroAddress } from 'viem'
import type { TAddress, TAddressLike, TAddressSmol, TDict } from '../types'
import { isTAddress, isZeroAddress } from './tools.is'

/******************************************************************************
 ** toAddress - Wagmi only requires a 0xString as a valid address. To use our
 ** safest version, we need to convert it between types, and the other way
 ** around.
 *****************************************************************************/
export function toAddress(address?: TAddressLike | null): TAddress {
	if (!address) {
		return zeroAddress
	}
	const trimmedAddress = address.trim()
	return getAddress(toChecksumAddress(trimmedAddress)?.valueOf())
}

/******************************************************************************
 * safeAddress - Returns a string that is safe to display as an address.
 *****************************************************************************/
export function toSafeAddress(props: {
	address?: TAddress
	ens?: string
	placeholder?: string
	addrOverride?: string
}): string {
	if (props.ens) {
		return props.ens
	}
	if (!isZeroAddress(props.address) && props.addrOverride) {
		return props.addrOverride
	}
	if (!isZeroAddress(props.address)) {
		return truncateHex(props.address, 5)
	}
	if (!props.address) {
		return props.placeholder || ''
	}
	return toAddress(props.address)
}

/******************************************************************************
 ** checksumAddress - Used to convert something looking like an address to
 ** a valid address. It will return the zero address if the address is not
 ** valid.
 *****************************************************************************/
function toChecksumAddress(address?: string | null | undefined): TAddressSmol {
	try {
		if (address && address !== 'GENESIS') {
			const checksummedAddress = getAddress(address)
			if (isTAddress(checksummedAddress)) {
				return checksummedAddress as TAddressSmol
			}
		}
	} catch {
		// console.error(error);
	}
	return zeroAddress as TAddressSmol
}

/******************************************************************************
 ** truncateHex is used to trucate a full hex string to a specific size with
 ** a ... in the middle. Ex: 0x1234567890abcdef1234567890abcdef12345678
 ** will be truncated to 0x1234...5678
 *****************************************************************************/
export function truncateHex(address: string | undefined, size: number): string {
	if (isZeroAddress(address)) {
		if (size === 0) {
			return zeroAddress
		}
		return `0x${zeroAddress.slice(2, size)}...${zeroAddress.slice(-size)}`
	}

	if (address !== undefined) {
		if (size === 0) {
			return address
		}
		if (address.length <= size * 2 + 4) {
			return address
		}
		return `0x${address.slice(2, size + 2)}...${address.slice(-size)}`
	}
	if (size === 0) {
		return zeroAddress
	}
	return `0x${zeroAddress.slice(2, size)}...${zeroAddress.slice(-size)}`
}

/******************************************************************************
 ** getColorFromAdddress - Used to generate a color from an address. This color
 ** is used as background color for the avatar.
 *****************************************************************************/
export function getColorFromAdddress({ address }: { address: TAddress }): string {
	if (!address) {
		return '#000000'
	}
	let hash = 0
	for (let i = 0; i < address.length; i++) {
		hash = address.charCodeAt(i) + ((hash << 5) - hash)
	}
	let color = '#'
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff
		color += value.toString(16).padStart(2, '0')
	}
	return color
}

/***************************************************************************
 ** toENS is used to find the ENS name of an address. It will return the
 ** address if no ENS name is found.
 **************************************************************************/
export function toENS(address: string | null | undefined, format?: boolean, size?: number): string {
	if (!address) {
		return address || ''
	}
	const _address = toAddress(address)
	const knownENS = process.env.KNOWN_ENS as unknown as TDict<string>
	if (knownENS?.[_address]) {
		return knownENS[_address]
	}
	if (format) {
		return truncateHex(_address, size || 4)
	}
	return address
}
