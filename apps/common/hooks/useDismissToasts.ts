import {yToast} from '@yearn-finance/web-lib/components/yToast';

type TUseDismissToasts = {
	dismissAllToasts: () => void;
	dismissToast: (toastId?: string) => void;
}

export function useDismissToasts(): TUseDismissToasts {
	const {toastMaster, useToasterStore} = yToast();
	const {toasts} = useToasterStore();
    
	return {
		dismissAllToasts: (): void => toasts.filter(({visible}): boolean => visible).forEach(({id}): void => toastMaster.dismiss(id)),
		dismissToast: (toastId?: string): void => toastMaster.dismiss(toastId)
	};
}
