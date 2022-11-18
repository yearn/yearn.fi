import React, {cloneElement, Fragment, ReactElement, useRef} from 'react';
import {Menu, Transition} from '@headlessui/react';
import IconChevron from 'components/icons/IconChevron';

export type TDropdownGaugeOption = {
	icon?: ReactElement;
	label: string;
	value: any;
	zapVia?: string;
};

export type TDropdownGaugesProps = {
	options: TDropdownGaugeOption[];
	defaultOption: TDropdownGaugeOption;
	selected: TDropdownGaugeOption;
	placeholder?: string;
	onSelect:
		| React.Dispatch<React.SetStateAction<TDropdownGaugeOption>>
		| ((option: TDropdownGaugeOption) => void);
};

function DropdownGauges({options, defaultOption, selected, onSelect, placeholder = ''}: TDropdownGaugesProps): ReactElement {
	const buttonRef = useRef<HTMLButtonElement>(null);
	return (
		<div>
			<Menu as={'menu'} className={'relative inline-block w-full text-left'}>
				{({open}): ReactElement => (
					<>
						<Menu.Button
							ref={buttonRef}
							className={'flex h-10 w-full items-center justify-between border border-neutral-600 p-2 text-base text-neutral-900'}>
							<div className={'flex flex-row items-center'}>
								{selected?.icon ? cloneElement(selected.icon) : <div className={'h-6 w-6 rounded-full bg-neutral-500'} />}
								<p className={`pl-2 ${(!selected?.label && !defaultOption?.label) ? 'text-neutral-400' : 'text-neutral-900'} font-normal`}>
									{selected?.label || defaultOption?.label || placeholder || 'Unknown'}
								</p>
							</div>
							<IconChevron className={`ml-3 h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
						</Menu.Button>
						<Transition
							as={Fragment}
							show={open}
							enter={'transition duration-100 ease-out'}
							enterFrom={'transform scale-95 opacity-0'}
							enterTo={'transform scale-100 opacity-100'}
							leave={'transition duration-75 ease-out'}
							leaveFrom={'transform scale-100 opacity-100'}
							leaveTo={'transform scale-95 opacity-0'}>
							<Menu.Items className={'yveCRV--dropdown-menu'}>
								{options.map((option, index): ReactElement => (
									<Menu.Item key={option?.label || index}>
										{({active}): ReactElement => (
											<div
												onClick={(): void => {
													onSelect(option);
													setTimeout((): void => buttonRef.current?.click(), 0);
												}}
												data-active={active}
												className={'yveCRV--dropdown-menu-item'}>
												{option?.icon ? cloneElement(option.icon) : null}
												<p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
													{option.label}
												</p>
											</div>
										)}
									</Menu.Item>
								))}
							</Menu.Items>
						</Transition>
					</>
				)}
			</Menu>
		</div>
	);
}

export {DropdownGauges};