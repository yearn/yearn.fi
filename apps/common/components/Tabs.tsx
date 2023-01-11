import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Listbox, Transition} from '@headlessui/react';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';

const variants = {
	initial: {y: 10, opacity: 0},
	enter: {y: 0, opacity: 1},
	exit: {y: -10, opacity: 0}
};

type TItem = {
	id: string,
	label: string,
	content: ReactElement
}

type TTabsProps = {
	items: TItem[],
	className?: string,
}

function Tabs({items, className}: TTabsProps): ReactElement {
	const [selectedTabId, set_selectedTabId] = useState(items[0]?.id);

	return (
		<div className={`w-full bg-neutral-100 ${className}`}>
			<nav className={'hidden h-14 w-full border-b-2 border-neutral-300 text-center md:flex'}>
				{items.map(({id, label}): ReactElement => (
					<div
						key={`tab-label-${id}`}
						className={`yearn--tab ${selectedTabId === id ? 'selected' : ''}`}
						onClick={(): void => set_selectedTabId(id)}>
						<p
							title={label}
							aria-selected={selectedTabId === id}
							className={'hover-fix align-center flex grow flex-col justify-center'}>
							{label}
						</p>
						{selectedTabId === id && <motion.div className={'relative -bottom-0.5 w-full border-b-[3px] border-neutral-700'} layoutId={'tab-label-underline'} />}
						{selectedTabId !== id && <motion.div className={'relative -bottom-0.5 w-full border-b-[3px] border-transparent'} />}
					</div>
				))}
			</nav>
			<div className={'relative z-50 px-4 pt-4'}>
				<Listbox
					value={selectedTabId}
					onChange={(value): void => set_selectedTabId(value)}>
					{({open}): ReactElement => (
						<>
							<Listbox.Button
								className={'flex h-10 w-full flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden'}>
								<div className={'relative flex flex-row items-center'}>
									{items.find(({id}): boolean => id === selectedTabId)?.label || 'Menu'}
								</div>
								<div className={'absolute right-4'}>
									<IconChevron
										className={`h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
								</div>
							</Listbox.Button>
							<Transition
								show={open}
								enter={'transition duration-100 ease-out'}
								enterFrom={'transform scale-95 opacity-0'}
								enterTo={'transform scale-100 opacity-100'}
								leave={'transition duration-75 ease-out'}
								leaveFrom={'transform scale-100 opacity-100'}
								leaveTo={'transform scale-95 opacity-0'}>
								<Listbox.Options className={'yearn--listbox-menu'}>
									{items.map(({id, label}): ReactElement => (
										<Listbox.Option
											className={'yearn--listbox-menu-item'}
											key={id}
											value={id}>
											{label}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</Transition>
						</>
					)}
				</Listbox>
			</div>
			<AnimatePresence mode={'wait'}>
				<motion.div
					key={selectedTabId}
					initial={'initial'}
					animate={'enter'}
					exit={'exit'}
					variants={variants}
					transition={{duration: 0.15}}
				>
					{items.map(({id, content}): ReactElement => (
						<div
							key={`tab-content-${id}`}
							className={'w-full p-8'}
							hidden={selectedTabId !== id}>
							{content}
						</div>
					))}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

export {Tabs};
