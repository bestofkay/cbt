import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-slate-900">
              {this.props.title ?? 'Something went wrong'}
            </h1>
            <p className="text-sm text-slate-600">
              An unexpected error occurred. Refresh the page to continue. If the problem persists,
              contact support.
            </p>
            {this.state.message ? (
              <p className="rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-500">
                {this.state.message}
              </p>
            ) : null}
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
