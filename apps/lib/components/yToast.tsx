import {toast as toastMaster, useToasterStore} from 'react-hot-toast';

import {IconAlertCritical} from '../icons/IconAlertCritical';
import {IconAlertError} from '../icons/IconAlertError';
import {IconAlertWarning} from '../icons/IconAlertWarning';
import {IconCheckmark} from '../icons/IconCheckmark';

import type {ReactElement} from 'react';
import type {ToastOptions} from 'react-hot-toast';

export type TCTA = {
	label: string;
	onClick: () => void;
};

type TYToast = {
	content: string;
	type: 'error' | 'warning' | 'success' | 'info';
	cta?: TCTA;
} & ToastOptions;

function buildMessage({content, cta}: Pick<TYToast, 'content' | 'cta'>): ReactElement {
	return (
		<div className={'flex items-center gap-2'}>
			{content}
			<button
				className={'yearn--toast-button'}
				onClick={cta?.onClick}>
				{cta?.label}
			</button>
		</div>
	);
}

export function toast({content, type, cta, ...toastOptions}: TYToast): string {
	const message = cta ? buildMessage({content, cta}) : content;

	switch (type) {
		case 'error':
			return toastMaster(message, {
				icon: <IconAlertCritical className={'ml-3'} />,
				style: {
					backgroundColor: '#C73203',
					color: 'white'
				},
				...toastOptions
			});
		case 'warning':
			return toastMaster(message, {
				icon: <IconAlertWarning className={'ml-3'} />,
				style: {
					backgroundColor: '#FFDC53'
				},
				...toastOptions
			});
		case 'success':
			return toastMaster(message, {
				icon: <IconCheckmark className={'ml-3'} />,
				style: {
					backgroundColor: '#00796D',
					color: 'white'
				},
				...toastOptions
			});
		case 'info':
			return toastMaster(message, {
				icon: <IconAlertError className={'ml-3'} />,
				style: {
					backgroundColor: '#0657F9',
					color: 'white'
				},
				...toastOptions
			});
		default:
			return toastMaster.success(content);
	}
}

export type TToastProps = {
	toast: (props: TYToast) => string;
	useToasterStore: typeof useToasterStore;
	toastMaster: typeof toastMaster;
};
export function yToast(): TToastProps {
	return {
		toast,
		useToasterStore,
		toastMaster
	};
}
