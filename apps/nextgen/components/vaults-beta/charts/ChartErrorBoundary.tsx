import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

type ChartErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type ChartErrorBoundaryState = {
  hasError: boolean
}

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Chart rendering error', error, errorInfo)
    }
  }

  reset = (): void => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            className={
              'flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-surface text-center'
            }
          >
            <p className={'text-sm font-medium text-text-primary'}>{'Chart unavailable'}</p>
            <p className={'text-xs text-text-secondary'}>{'Unable to render chart data right now.'}</p>
            <button
              type={'button'}
              onClick={this.reset}
              className={'mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary'}
            >
              {'Try again'}
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
