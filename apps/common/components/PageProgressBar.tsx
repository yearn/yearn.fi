import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useClientEffect} from '@yearn-finance/web-lib/hooks';

import type {ReactElement} from 'react';

type TPageProgressBarProps = {
  isLoading: boolean;
}

function PageProgressBar({isLoading}: TPageProgressBarProps): ReactElement {
	const {onLoadStart, onLoadDone} = useUI();
    
	useClientEffect((): () => void => {
		if (isLoading) {
			onLoadStart();
		} else {
			onLoadDone();
		}

		return (): void => {
			onLoadDone();
		};
	}, [isLoading]);

	return <></>;
}

export {PageProgressBar};
