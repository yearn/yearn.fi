import {zeroAddress} from 'viem'
import type {TAddress} from '../types/address'
import {ETH_TOKEN_ADDRESS} from './constants'
import {toAddress} from './tools.address'

export function isZero(value?: bigint | number | string | null): boolean {
	if (value === null || value === undefined) {
		return false
	}

	if (typeof value === 'string') {
		value = value.trim().replace(',', '.')

		if (value === '') {
			return false
		}

		// Check if the string can be parsed as a floating-point number
		const parsed = Number(value)
		if (!Number.isNaN(parsed)) {
			return parsed === 0
		}
	}

	try {
		return BigInt(value) === 0n
	} catch {
		return false
	}
}

/******************************************************************************
 * isAddress - Checks if a string is a valid Ethereum address.
 *****************************************************************************/
export function isAddress(address?: string | null): address is TAddress {
	const regex = /^0x([0-9a-f][0-9a-f])*$/i
	return !!address && regex.test(address) && !isZeroAddress(address)
}

/******************************************************************************
 * isTAddress - Checks if a string is a valid TAddress type.
 *****************************************************************************/
export function isTAddress(address?: string | null): address is TAddress {
	const regex = /^0x([0-9a-f][0-9a-f])*$/i
	return !!address && regex.test(address)
}

/******************************************************************************
 * isTAddress - Checks if the address is the zero address.
 *****************************************************************************/
export function isZeroAddress(address?: string): boolean {
	return toAddress(address) === toAddress(zeroAddress)
}

/******************************************************************************
 * isTAddress - Checks if the address is the ETH address
 *****************************************************************************/
export function isEthAddress(address?: string | null | TAddress): boolean {
	return toAddress(address) === toAddress(ETH_TOKEN_ADDRESS)
}

export function isNumber(value: string | number): value is number {
	if (value === null || value === undefined) {
		return false
	}
	if (typeof value === 'string' && value.trim() === '') {
		return false
	}
	if (typeof value === 'object') {
		return false
	}
	return !Number.isNaN(+value)
}

export function isNonNullable<T>(value: T): value is NonNullable<T> {
	return value !== null && value !== undefined
}

export function isString(value: unknown): value is string {
	return typeof value === 'string'
}

export function isObject(input: unknown): input is {[key: string]: unknown} {
	return typeof input === 'object' && input !== null && !Array.isArray(input)
}
