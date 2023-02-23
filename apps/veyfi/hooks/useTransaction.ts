import {useState} from 'react';
import {yToast} from '@yearn-finance/web-lib/components/yToast';

import type {ethers} from 'ethers';

type TStatus = {
	loading?: boolean;
	error?: string;
	executed?: boolean;
}

type TTxFuncArgs = Parameters<(arg1: ethers.providers.JsonRpcProvider, ...args: unknown[] ) => void>

type TTxFunc<T1 extends TTxFuncArgs, T2> = (...args: T1) => Promise<T2>;

export const useTransaction = <T extends TTxFuncArgs>(
	func: TTxFunc<T, boolean>,
	onSuccess?: (payload: boolean | undefined) => void,
	onError?: (error: unknown) => void
): [TTxFunc<T, boolean | undefined>, TStatus, boolean | undefined] => {
	const {toast} = yToast();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const [result, set_result] = useState<boolean | undefined>();
	const [isLoading, set_isLoading] = useState(false);
	const [error, set_error] = useState<string | undefined>(undefined);
	const [isExecuted, set_isExecuted] = useState<boolean>(false);

	const status: TStatus = {
		loading: isLoading,
		error,
		executed: isExecuted
	};

	const execute = async (...p: T): Promise<boolean | undefined> => {
		set_isLoading(true);
		set_error(undefined);
		let funcResult;
		try {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const funcResult = await func(...p);
			if(!funcResult) {
				throw new Error('Transaction failed');
			}
			set_result(funcResult);
			set_isLoading(false);
			set_isExecuted(true);
			toast({content: 'Transaction successful', type: 'success'});
		} catch (error: unknown) {
			if(error instanceof Error){
				console.error(error.message);
				set_error(error.message);
			} else {
				console.error(error);
				set_error('Unknown error');
			}
			set_result(undefined);
			set_isLoading(false);
			set_isExecuted(false);
			if (onError) {
				onError(error);
			}
			toast({content: 'Transaction failed', type: 'error'});
			return;
		}

		if (onSuccess) {
			onSuccess(funcResult);
		}
		return funcResult;
	};

	return [execute, status, result];
};
