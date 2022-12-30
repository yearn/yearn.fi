import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

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
			<div className={'align-center flex h-14 w-full justify-center border-b-2 border-neutral-300 text-center'}>
				{items.map(({id, label}): ReactElement => (
					<div
						key={`tab-label-${id}`}
						className={`align-center mx-5 flex h-full flex-col justify-center text-base ${selectedTabId !== id ? 'cursor-pointer font-normal' : 'cursor-default font-bold'}`}
						onClick={(): void => set_selectedTabId(id)}
					>
						<div className={'align-center flex grow flex-col justify-center'}>
							{label}
						</div>
						{selectedTabId === id && <motion.div className={'relative -bottom-0.5 w-full border-b-[3px] border-neutral-700'} layoutId={'tab-label-underline'} />}
						{selectedTabId !== id && <motion.div className={'relative -bottom-0.5 w-full border-b-[3px] border-transparent'} />}
					</div>
				))}
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
