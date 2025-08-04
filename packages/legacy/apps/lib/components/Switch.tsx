import {Switch as HeadlessSwitch} from '@headlessui/react';
import {cl} from '@lib/utils';
import type {KeyboardEvent, ReactElement} from 'react';
import {useState} from 'react';

type TSwitch = {
	isEnabled: boolean;
	onSwitch?: () => void;
	isDisabled?: boolean;
};

export function Switch(props: TSwitch): ReactElement {
	const {isEnabled, onSwitch, isDisabled = false} = props;
	const [isEnabledState, setIsEnabledState] = useState(isEnabled);

	function safeOnSwitch(): void {
		onSwitch ? onSwitch() : setIsEnabledState(!isEnabledState);
	}

	const isChecked = onSwitch ? isEnabled : isEnabledState;

	function handleOnKeyDown({key}: KeyboardEvent<HTMLButtonElement>): void {
		if (key !== 'Enter') {
			return;
		}

		safeOnSwitch();
	}

	return (
		<div>
			<HeadlessSwitch
				checked={isChecked}
				onChange={safeOnSwitch}
				onKeyDown={handleOnKeyDown}
				disabled={isDisabled}
				className={'yearn--next-switch'}
			>
				<span className={'sr-only'}>{'Use setting'}</span>
				<div aria-hidden={'true'} className={cl(isChecked ? 'translate-x-[14px]' : 'translate-x-0')} />
			</HeadlessSwitch>
		</div>
	);
}
