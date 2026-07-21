import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  renderFallback?: (error: Error | null, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.renderFallback) {
        return this.props.renderFallback(this.state.error, this.reset)
      }
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Something went wrong</h3>
            <p className="max-w-md text-xs text-muted-foreground">{this.state.error.message}</p>
          </div>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={this.reset}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
