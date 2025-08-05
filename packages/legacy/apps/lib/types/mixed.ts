import type { TAddress } from './address'

/*******************************************************************************
 ** Maybe types are used to represent optional values
 ******************************************************************************/
export type Maybe<T> = T | undefined

/*******************************************************************************
 ** Dict types are used to represent objects with string/number keys
 ******************************************************************************/
export type TDict<T> = { [key: string]: T }
export type Dict<T> = TDict<T>
export type TNDict<T> = { [key: number]: T }
export type NDict<T> = TNDict<T>

/*******************************************************************************
 ** VoidPromiseFunction is used to represent a function that returns a Promise<void>
 ******************************************************************************/
export type VoidPromiseFunction = () => Promise<void>

/*******************************************************************************
 ** A proper way to use the bigint conversion
 ******************************************************************************/
export type TNumberish = bigint | number | string | `${number}` //wagmi weird type
export type TNormalizedBN = { raw: bigint; normalized: number; display: string }

/*******************************************************************************
 ** A classic ERC20 token & the one wrapped by chainID
 ******************************************************************************/
export type TToken = {
	address: TAddress
	name: string
	symbol: string
	decimals: number
	chainID: number
	logoURI?: string
	value: number
	balance: TNormalizedBN
}
export type TChainTokens = TNDict<TDict<TToken>>

/**************************************************************************************************
 ** The TTokenAmountInputElement type definition is used in the SmolTokenAmountInput component
 ** and define the different properties that are used to represent a token amount input element.
 ** The properties are:
 ** - amount: string - Represents what the user inputed
 ** - value?: number - Represents the value of the input element
 ** - normalizedBigAmount: TNormalizedBN - Represents the normalized amount, used for calculations
 ** - token: TToken | undefined - Represents the token that the user selected
 ** - status: 'pending' | 'success' | 'error' | 'none' - Represents the status of the input element
 ** - isValid: boolean | 'undetermined' - Represents if the input is valid
 ** - error?: string | undefined - Represents the error message if the input is invalid
 ** - UUID: string - Represents the unique identifier of the input element
 *************************************************************************************************/
export type TTokenAmountInputElement = {
	amount: string
	value?: number
	normalizedBigAmount: TNormalizedBN
	token: TToken | undefined
	status: 'pending' | 'success' | 'error' | 'none'
	isValid: boolean | 'undetermined'
	error?: string | undefined
	UUID: string
}

/*******************************************************************************
 ** A classic Sort direction element
 ******************************************************************************/
export type TSortDirection = 'asc' | 'desc' | '' | null

/*******************************************************************************
 ** Default status to mimic wagmi hooks.
 ******************************************************************************/
export type TDefaultStatus = {
	isFetching: boolean
	isFetched: boolean
	isRefetching: boolean
	isLoading: boolean
	isSuccess: boolean
	isError: boolean
}

/*******************************************************************************
 ** Request, Response and helpers for the useBalance hook.
 ******************************************************************************/
export type TBalanceData = {
	decimals: number
	symbol: string
	name: string
	raw: bigint
	normalized: number
	//Optional
	rawPrice?: bigint
	normalizedPrice?: number
	normalizedValue?: number
	force?: boolean
}

/*******************************************************************************
 ** Classic tokenlist structure
 ******************************************************************************/
export type TTokenList = {
	name: string
	description: string
	timestamp: string
	logoURI: string
	uri: string
	keywords: string[]
	version: {
		major: number
		minor: number
		patch: number
	}
	tokens: {
		address: TAddress
		name: string
		symbol: string
		decimals: number
		chainId: number
		logoURI?: string
	}[]
}

export type TGraphData = {
	name: string
	value: number
}

export type TMessariGraphData = {
	name: string
	tvl: number
	pps: number
}

export type TYToken = TToken & {
	stakingValue: number
}
export type TYChainTokens = TNDict<TDict<TYToken>>

export type TApp = {
	name: string
	description?: string
	logoURI: string
	appURI: string
}
