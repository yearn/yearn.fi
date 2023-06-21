import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';

type TProps = {
	chainID: number | string;
};

export function useYDaemonBaseURI({chainID}: TProps): {
	yDaemonBaseUri: string;
} {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const {settings} = useSettings();

	const baseUri = settings.yDaemonBaseURI || String(process.env.YDAEMON_BASE_URI);

	return {yDaemonBaseUri: `${baseUri}/${chainID}`};
}
