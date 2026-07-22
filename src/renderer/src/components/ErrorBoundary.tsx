import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 14, color: '#f00', whiteSpace: 'pre-wrap' }}>
          <h2 style={{ marginBottom: 16 }}>Renderer Error</h2>
          <div>{this.state.error?.message}</div>
          <div style={{ marginTop: 16, color: '#666' }}>{this.state.error?.stack}</div>
        </div>
      )
    }
    return this.props.children
  }
}
