import {Fragment, useState} from 'react';
import {usePopper} from 'react-popper';
import {useRouter} from 'next/router';
import html2canvas from 'html2canvas';
import axios from 'axios';
import {Popover as PopoverHeadlessUI, Portal, Transition} from '@headlessui/react';
import {useLocalStorageValue} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import MessageIcon from '@common/icons/MessageIcon';

import type {ReactElement} from 'react';

type TRequestType = 'bug' | 'feature';

export function Popover(): ReactElement {
	const [referenceElement, set_referenceElement] = useState<HTMLButtonElement | null>(null);
	const [popperElement, set_popperElement] = useState<HTMLDivElement | null>(null);
	const [type, set_type] = useState<TRequestType>('bug');
	const [description, set_description] = useState<string>();
	const {address, chainID, ens, lensProtocolHandle, walletType} = useWeb3();
	const router = useRouter();
	const {value: hasPopover, set: set_hasPopover} = useLocalStorageValue<boolean>('yearn.finance/feedback-popover');
	const {styles, attributes} = usePopper(referenceElement, popperElement, {
		modifiers: [{name: 'offset', options: {offset: [0, 10]}}],
		placement: 'bottom-end'
	});

	async function onSubmit(closeCallback: VoidFunction): Promise<void> {
		const {body} = document;
		if (body) {
			const canvas = await html2canvas(body, {
				backgroundColor: null,
				allowTaint: true,
				ignoreElements: (element): boolean => element.id === 'headlessui-portal-root'
			});
			const reporter = ens || lensProtocolHandle || (address ? truncateHex(toAddress(address), 4) : '');
			const formData = new FormData();
			const blob = await new Promise((resolve): void => {
				canvas.toBlob((blob): void => resolve(blob));
			});
			formData.append('screenshot', blob as Blob);
			formData.append('messages', [
				`*🔵 New ${type} submitted*`,
				description,
				'\n*👀 - Info:*',
				reporter ?
					`\t\t\t\tFrom: [${reporter}](https://etherscan.io/address/${address})` :
					'\t\t\t\tFrom: [wallet-not-connected]',
				`\t\t\t\tChain: ${chainID}`,
				`\t\t\t\tWallet: ${walletType}`,
				`\t\t\t\tOrigin: [${router.asPath}](https://yearn.finance/${router.asPath})`
			].join('\n'));
			await axios.post('/api/notify', formData, {
				headers: {'Content-Type': 'multipart/form-data'}
			});
			console.log(`${type} submitted!\n\n${description}`);
		}
		closeCallback();
	}

	return (
		<Portal>
			<PopoverHeadlessUI className={'relative'}>
				<PopoverHeadlessUI.Button
					className={'fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500'}
					ref={set_referenceElement}>
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
					leaveTo={'opacity-0'}>
					<PopoverHeadlessUI.Panel
						ref={set_popperElement}
						style={styles.popper}
						{...attributes.popper}>
						{({close}): ReactElement => (
							<div className={'flex flex-col space-y-2 overflow-hidden rounded-lg border border-neutral-300/50 bg-neutral-0 p-6 pb-3 shadow shadow-transparent'}>
								<select
									name={'type'}
									id={'type'}
									className={'cursor-pointer border border-neutral-300/50 bg-transparent text-xs transition-colors hover:bg-neutral-100/40 focus:border-neutral-300/50'}
									onChange={({target:{value}}): void => {
										if (isRequestTypeKnown(value)) {
											set_type(value);
										}
									}}>
									<option value={'bug'}>{'Bug'}</option>
									<option value={'feature'}>{'Feature'}</option>
								</select>
								<textarea
									id={'description'}
									cols={30}
									rows={4}
									className={'resize-none border border-neutral-300/50 bg-transparent text-xs transition-colors hover:bg-neutral-100/40 focus:border-neutral-300/50'}
									onChange={({target:{value}}): void => set_description(value)} />
								<button
									className={'relative h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs text-neutral-0 transition-all hover:bg-neutral-800'}
									onClick={async (): Promise<void> => onSubmit(close)}>
									{'Submit'}
								</button>
								<label className={'flex cursor-pointer items-center justify-end pt-2'}>
									<button
										className={'text-right text-xs text-neutral-200 transition-colors hover:text-neutral-400'}
										onClick={(): void => set_hasPopover(!hasPopover)}>
										{'Hide me forever'}
									</button>
								</label>
							</div>
						)}

					</PopoverHeadlessUI.Panel>
				</Transition>
			</PopoverHeadlessUI>
		</Portal>
	);
}

function isRequestTypeKnown(type: string): type is TRequestType {
	return type === 'bug' || type === 'feature';
}
