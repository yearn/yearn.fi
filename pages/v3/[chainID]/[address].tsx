import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';

import type {GetStaticPaths, GetStaticProps} from 'next';
import type {ReactElement} from 'react';

function Index(): ReactElement | null {
	const router = useRouter();
	const [isLoading, set_isLoading] = useState(true);

	useEffect((): void => {
		if (router.isReady) {
			set_isLoading(false);
		}
	}, [router.isReady]);

	// Loading state
	if (isLoading) {
		return (
			<div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
				<div className={'mt-[20%] flex h-10 items-center justify-center'}>
					<div className={'size-8 animate-spin rounded-full border-b-2 border-gray-900'} />
				</div>
			</div>
		);
	}

	return (
		<div className={'mx-auto w-full max-w-6xl pt-20 md:pt-32'}>
			<div className={'text-center'}>
				<h1 className={'text-2xl font-bold text-neutral-900'}>
					{`Vault ${router.query.address || 'Loading...'}`}
				</h1>
				<p className={'mt-4 text-neutral-600'}>{`Chain ID: ${router.query.chainID || 'Loading...'}`}</p>
				<div className={'mt-8 rounded-lg bg-neutral-100 p-8'}>
					<p className={'text-neutral-700'}>
						{'Vault details will be loaded here once the EMFILE issue is resolved.'}
					</p>
				</div>
			</div>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getStaticPaths = (async () => {
	return {
		paths: [],
		fallback: true
	};
}) satisfies GetStaticPaths;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getStaticProps: GetStaticProps = async () => {
	return {
		props: {}
	};
};

export default Index;
