import {type ReactElement, useEffect} from 'react';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';

type TPageProgressBarProps = {
	isLoading: boolean;
};

export function PageProgressBar({isLoading}: TPageProgressBarProps): ReactElement {
	const {onLoadStart, onLoadDone} = useUI();

	useEffect((): VoidFunction => {
		if (isLoading) {
			onLoadStart();
		} else {
			onLoadDone();
		}

		return (): void => {
			onLoadDone();
		};
	}, [isLoading, onLoadDone, onLoadStart]);

	return <></>;
}
