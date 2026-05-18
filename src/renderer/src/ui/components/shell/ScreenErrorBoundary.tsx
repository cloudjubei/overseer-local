import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'

type Props = {
  /** A short label for the screen, surfaced when something goes wrong. */
  screen: string
  children: ReactNode
}

type State = {
  error: Error | null
}

/**
 * Catches render errors thrown by a single screen so the rest of the shell
 * (tab bar, sidebar, status indicators) keeps working. The user can dismiss
 * the error to retry rendering once they've, e.g., switched projects.
 */
export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.screen}] render error`, error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-6 max-w-2xl">
        <Alert>
          <div className="flex flex-col gap-3">
            <div>
              <strong>The “{this.props.screen}” screen crashed.</strong>
              <div className="text-sm mt-1 opacity-80">{this.state.error.message}</div>
            </div>
            <div>
              <Button size="sm" variant="secondary" onClick={this.reset}>
                Try again
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    )
  }
}
