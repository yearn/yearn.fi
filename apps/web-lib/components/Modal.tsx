import React, {Fragment, useRef} from 'react';
import {Dialog, Transition, TransitionChild} from '@headlessui/react';

import type {ReactElement, ReactNode} from 'react';

export type TModal = {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
} & React.ComponentPropsWithoutRef<'div'>;

function Modal(props: TModal): ReactElement {
	const {isOpen, onClose, className = '', children} = props;
	const ref = useRef() as React.MutableRefObject<HTMLDivElement>;

	return (
		<Transition
			show={isOpen}
			as={Fragment}>
			<Dialog
				as={'div'}
				className={'fixed inset-0 isolate overflow-y-auto'}
				style={{zIndex: 88}}
				initialFocus={ref}
				onClose={onClose}>
				<div className={`${className} yearn--modal-wrapper`}>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-300'}
						enterFrom={'opacity-0'}
						enterTo={'opacity-100'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100'}
						leaveTo={'opacity-0'}>
						<div className={`${className} yearn--modal-overlay`} />
					</TransitionChild>

					<span
						className={'hidden sm:inline-block sm:h-screen sm:align-middle'}
						aria-hidden={'true'}>
						&#8203;
					</span>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-300'}
						enterFrom={'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'}
						enterTo={'opacity-100 translate-y-0 sm:scale-100'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100 translate-y-0 sm:scale-100'}
						leaveTo={'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'}>
						<div
							ref={ref}
							className={`${className} yearn--modal`}>
							{children}
						</div>
					</TransitionChild>
				</div>
			</Dialog>
		</Transition>
	);
}

export {Modal};
