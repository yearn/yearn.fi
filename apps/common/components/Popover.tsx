import {Fragment, useState} from 'react';
import {usePopper} from 'react-popper';
import {useRouter} from 'next/router';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import axios from 'axios';
import {Popover as PopoverHeadlessUI, Portal, Transition} from '@headlessui/react';
import {useLocalStorageValue} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {useTimer} from '@common/hooks/useTimer';
import MessageIcon from '@common/icons/MessageIcon';

import type {ReactElement} from 'react';

type TRequestType = 'bug' | 'feature';

export function Popover(): ReactElement {
	const [referenceElement, set_referenceElement] = useState<HTMLButtonElement | null>(null);
	const [popperElement, set_popperElement] = useState<HTMLDivElement | null>(null);
	const [type, set_type] = useState<TRequestType>('bug');
	const [telegramHandle, set_telegramHandle] = useState<string>();
	const [isSubmitDisabled, set_isSubmitDisabled] = useState<boolean>(false);
	const [description, set_description] = useState<string>();
	const {address, chainID, ens, lensProtocolHandle, walletType} = useWeb3();
	const router = useRouter();
	const {value: hasPopover, set: set_hasPopover} = useLocalStorageValue<boolean>('yearn.finance/feedback-popover');
	const {value: nextSubmissionTime, set: set_nextSubmissionTime} = useLocalStorageValue<number>('yearn.finance/popover-cooling-off');
	const {styles, attributes} = usePopper(referenceElement, popperElement, {
		modifiers: [{name: 'offset', options: {offset: [0, 10]}}],
		placement: 'bottom-end'
	});
	const timeLeft = useTimer({endTime: nextSubmissionTime});
	const isCoolingOff = getIsCoolingOff({nextSubmissionTime});

	async function onSubmit(closeCallback: VoidFunction): Promise<void> {
		set_isSubmitDisabled(true);

		const {body} = document;
		if (!body) {
			set_isSubmitDisabled(false);
			closeCallback();
			return;
		}
		const canvas = await html2canvas(body, {
			allowTaint: true,
			width: window.innerWidth,
			height: window.innerHeight,
			scrollX: window.scrollX,
			scrollY: window.scrollY,
			x: window.scrollX,
			y: window.scrollY + window.scrollY,
			ignoreElements: (element): boolean => element.id === 'headlessui-portal-root'
		});
		const reporter = ens || lensProtocolHandle || (address ? truncateHex(toAddress(address), 4) : '');
		const formData = new FormData();
		const blob = await new Promise<Blob | null>((resolve): void => {
			canvas.toBlob((blob): void => resolve(blob));
		});
		if (blob) {
			formData.append('screenshot', blob);
		}
		formData.append('messages', [
			`*🔵 New ${type} submitted*`,
			`\n*Telegram:* ${telegramHandle}`,
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
		closeCallback();
		set_nextSubmissionTime(dayjs().add(5, 'minutes').unix());
		set_isSubmitDisabled(false);
	}

	return (
		<Portal>
			<PopoverHeadlessUI className={'relative z-50'}>
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
								{isCoolingOff && <small>{`You can submit another report in ${timeLeft}`}</small>}
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
									className={'resize-none border border-neutral-300/50 bg-transparent p-2 text-xs transition-colors hover:bg-neutral-100/40 focus:border-neutral-300/50'}
									onChange={({target:{value}}): void => set_description(value)}
									placeholder={`Describe the ${type} in detail`}
								/>
								<input
									id={'telegramHandle'}
									className={'resize-none border border-neutral-300/50 bg-transparent p-2 text-xs transition-colors hover:bg-neutral-100/40 focus:border-neutral-300/50'}
									onChange={({target:{value}}): void => set_telegramHandle(value)}
									placeholder={'Your telegram handle'}
								/>
								<button
									disabled={!description || description.length < 10 || isCoolingOff || isSubmitDisabled}
									className={'relative h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs text-neutral-0 transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40'}
									onClick={async (): Promise<void> => onSubmit(close)}>
									{!isCoolingOff ? 'Submit' : `Please wait ${timeLeft}`}
								</button>
								<label className={'max-w-xs items-center justify-end pt-2'}>
									<p className={'text-right text-xs italic text-neutral-200'}>
										{'Address and screenshot of page will be attached'}
									</p>
									<p className={'text-right text-xs italic text-neutral-200'}>
										{'For internal use only'}
									</p>
								</label>
								<label className={'flex cursor-pointer items-center justify-end'}>
									<button
										className={'text-right text-xs text-neutral-200 underline transition-colors hover:text-neutral-400'}
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

function getIsCoolingOff({nextSubmissionTime}: {nextSubmissionTime?: number}): boolean {
	if (!nextSubmissionTime) {
		return false;
	}

	return dayjs().isBefore(dayjs(nextSubmissionTime * 1000));
}
