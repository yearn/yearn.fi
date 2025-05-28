// filepath: apps/common/components/ErrorBoundary.tsx
import React, {Component} from 'react';

import type {ErrorInfo, ReactNode} from 'react';

type TProps = {
	children: ReactNode;
	fallback?: ReactNode;
};

type TState = {
	hasError: boolean;
	error?: Error;
};

class ErrorBoundary extends Component<TProps, TState> {
	public state: TState = {
		hasError: false
	};

	public static getDerivedStateFromError(error: Error): TState {
		return {hasError: true, error};
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
		// You could also log the error to an error reporting service here
	}

	public render(): ReactNode {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div style={{padding: '20px', textAlign: 'center'}}>
						<h1>{'Something went wrong.'}</h1>
						<p>{"We're sorry for the inconvenience. Please try refreshing the page."}</p>
						{/* You might want to display error details in development */}
						{process.env.NODE_ENV === 'development' && this.state.error && (
							<pre style={{textAlign: 'left', background: '#f0f0f0', padding: '10px', overflowX: 'auto'}}>
								{this.state.error.stack}
							</pre>
						)}
					</div>
				)
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
