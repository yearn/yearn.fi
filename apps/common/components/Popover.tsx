import {Fragment, useState} from 'react';
import {usePopper} from 'react-popper';
import {Popover as PopoverHeadlessUI, Transition} from '@headlessui/react';

import type {ReactElement} from 'react';

export function Popover(): ReactElement {
	const [referenceElement, set_referenceElement] = useState<HTMLButtonElement | null>(null);
	const [popperElement, set_popperElement] = useState<HTMLDivElement | null>(null);
	const {styles, attributes} = usePopper(referenceElement, popperElement, {
		modifiers: [{name: 'offset', options: {offset: [-100, 10]}}]
	});
    
	return (
		<PopoverHeadlessUI className={'relative'}>
			<PopoverHeadlessUI.Button
				className={'fixed bottom-5 right-5 h-10 w-10 rounded-full bg-orange-500'}
				ref={set_referenceElement}
			>
				{'FA'}
			</PopoverHeadlessUI.Button>
			<PopoverHeadlessUI.Overlay className={'fixed inset-0 bg-black opacity-30'} />
			<Transition
				as={Fragment}
				enter={'transition ease-out duration-200'}
				enterFrom={'opacity-0'}
				enterTo={'opacity-100'}
				leave={'transition ease-in duration-150'}
				leaveFrom={'opacity-100'}
				leaveTo={'opacity-0'}
			>
				<PopoverHeadlessUI.Panel
					ref={set_popperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<div className={'overflow-hidden rounded-lg bg-white p-5'}>
						<div className={'space-y-2'}>
							<label htmlFor={'type'}>{'type'}</label>
							<div>
								<select name={'type'} id={'type'}>
									<option value={'bug'}>{'bug'}</option>
									<option value={'feature'}>{'feature'}</option>
								</select>
							</div>
							<label htmlFor={'description'}>{'description'}</label>
							<div>
								<textarea id={'description'}/>
							</div>
							<button>{'Submit'}</button>
						</div>
					</div>
				</PopoverHeadlessUI.Panel>
			</Transition>
		</PopoverHeadlessUI>
	);
}
