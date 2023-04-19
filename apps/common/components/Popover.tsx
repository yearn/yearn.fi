import {Fragment, useState} from 'react';
import {usePopper} from 'react-popper';
import {Popover as PopoverHeadlessUI, Transition} from '@headlessui/react';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {Switch} from '@common/components/Switch';
import MessageIcon from '@common/icons/MessageIcon';

import type {ReactElement} from 'react';

type TRequestType = 'bug' | 'feature';

export function Popover(): ReactElement {
	const [referenceElement, set_referenceElement] = useState<HTMLButtonElement | null>(null);
	const [popperElement, set_popperElement] = useState<HTMLDivElement | null>(null);
	const {styles, attributes} = usePopper(referenceElement, popperElement, {
		modifiers: [{name: 'offset', options: {offset: [0, 10]}}],
		placement: 'bottom-end'
	});
	const [type, set_type] = useState<TRequestType>('bug');
	const [description, set_description] = useState<string>();
	const [isPopoverHidden, set_isPopoverHidden] = useLocalStorage<boolean>('yearn.finance/feedback-popover', false);
    
	return (
		<PopoverHeadlessUI className={'relative'}>
			<PopoverHeadlessUI.Button
				className={'fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500'}
				ref={set_referenceElement}
			>
				<MessageIcon />
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
					{({close}): ReactElement => (
						<div className={'flex flex-col space-y-2 overflow-hidden rounded-lg bg-white p-5'}>
							<select
								name={'type'}
								id={'type'}
								className={'text-xs'}
								onChange={({target:{value}}): void => {
									if (isRequestTypeKnown(value)) {
										set_type(value);
									}
								}}
							>
								<option value={'bug'}>{'Bug'}</option>
								<option value={'feature'}>{'Feature'}</option>
							</select>
							<textarea
								id={'description'}
								cols={30}
								rows={4}
								className={'resize-none text-xs'}
								onChange={({target:{value}}): void => set_description(value)}
							/>
							<button
								className={'relative h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs text-neutral-0 transition-all hover:bg-neutral-800'}
								onClick={(): void => {
									alert(`${type} submitted!\n\n${description}`);
									close();
								}}
							>{'Submit'}
							</button>
							<label className={'flex cursor-pointer items-center justify-between pt-4 transition-colors hover:bg-neutral-100/40'}>
								<p className={'text-xs'}>{'Hide me forever'}</p>
								<Switch
									isEnabled={isPopoverHidden}
									onSwitch={(v): void => set_isPopoverHidden(v)} />
							</label>
						</div>
					)}

				</PopoverHeadlessUI.Panel>
			</Transition>
		</PopoverHeadlessUI>
	);
}

function isRequestTypeKnown(type: string): type is TRequestType {
	return type === 'bug' || type === 'feature';
}
