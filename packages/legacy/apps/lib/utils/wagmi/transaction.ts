import type React from 'react'
import type {BaseError, TransactionReceipt} from 'viem'
import type {Connector} from 'wagmi'

const timeout = 3000
export const defaultTxStatus = {none: true, pending: false, success: false, error: false}
const errorTxStatus = {none: false, pending: false, success: false, error: true}
const pendingTxStatus = {none: false, pending: true, success: false, error: false}
const successTxStatus = {none: false, pending: false, success: true, error: false}

export type TTxStatus = {
	none: boolean
	pending: boolean
	success: boolean
	error: boolean
	errorMessage?: string
}
export type TBaseError = {
	name?: string
	message: string
}
export type TTxResponse = {
	isSuccessful: boolean
	receipt?: TransactionReceipt
	error?: BaseError | unknown
}

export class Transaction {
	provider: Connector
	onStatus: React.Dispatch<React.SetStateAction<TTxStatus>>
	options?: {shouldIgnoreSuccessTxStatusChange: boolean}
	txArgs?: unknown[]
	funcCall: (provider: Connector, ...rest: never[]) => Promise<TTxResponse>
	successCall?: (receipt?: TransactionReceipt) => Promise<void>

	constructor(
		provider: Connector,
		funcCall: (provider: Connector, ...rest: never[]) => Promise<TTxResponse>,
		onStatus: React.Dispatch<React.SetStateAction<TTxStatus>>,
		options?: {shouldIgnoreSuccessTxStatusChange: boolean}
	) {
		this.provider = provider
		this.funcCall = funcCall
		this.onStatus = onStatus
		this.options = options
	}

	populate(...txArgs: unknown[]): Transaction {
		this.txArgs = txArgs
		return this
	}

	onSuccess(onSuccess: (receipt?: TransactionReceipt) => Promise<void>): Transaction {
		this.successCall = onSuccess
		return this
	}

	onHandleError(error: string): void {
		this.onStatus({...errorTxStatus, errorMessage: error})
		setTimeout((): void => this.onStatus(defaultTxStatus), timeout)
	}

	async perform(): Promise<TTxResponse> {
		this.onStatus(pendingTxStatus)
		try {
			const args = (this.txArgs || []) as never[]
			const {isSuccessful, receipt, error} = await this.funcCall(this.provider, ...args)
			if (isSuccessful) {
				if (this.successCall && receipt) {
					await this.successCall(receipt)
				}
				if (this?.options?.shouldIgnoreSuccessTxStatusChange) {
					return {isSuccessful, receipt}
				}
				this.onStatus(successTxStatus)
				setTimeout((): void => this.onStatus(defaultTxStatus), timeout)
				return {isSuccessful, receipt}
			}
			this.onHandleError((error as TBaseError)?.message || 'Transaction failed')
			return {isSuccessful: false}
		} catch (error) {
			const err = error as BaseError
			this.onHandleError(err?.shortMessage || err?.message || 'Transaction failed')
			return {isSuccessful: false}
		}
	}
}
