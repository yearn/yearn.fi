import {NextResponse} from 'next/server';

import type {NextRequest} from 'next/server';

export function middleware(request: NextRequest): NextResponse | void {
	const {pathname} = request.nextUrl;

	// Handle /v3/{chainId} pattern and redirect to /v3?chains={chainId}
	const v3ChainMatch = pathname.match(/^\/v3\/(\d+)$/);
	if (v3ChainMatch) {
		const [, chainId] = v3ChainMatch;
		const url = request.nextUrl.clone();
		url.pathname = '/v3';
		url.searchParams.set('chains', chainId);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: '/v3/:chainId(\\d+)'
};
