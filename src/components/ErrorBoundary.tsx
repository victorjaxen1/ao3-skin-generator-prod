import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Prevents the entire app from crashing due to a single component error
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-gray-600">An unexpected error occurred</p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-gray-50 rounded p-3 text-xs">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong className="text-red-600">Error:</strong>
                    <pre className="mt-1 text-gray-800 whitespace-pre-wrap break-words">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong className="text-red-600">Component Stack:</strong>
                      <pre className="mt-1 text-gray-800 whitespace-pre-wrap break-words text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Don't worry - your work is automatically saved. Try one of these options:
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                >
                  Try Again
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-800">
                💡 <strong>Tip:</strong> If this keeps happening, try clearing your browser cache or using a different browser.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Minimal Error Boundary for smaller sections
 */
export class MinimalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MinimalErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 text-sm">Error loading this section</h3>
              <p className="text-xs text-red-700 mt-1">
                Something went wrong. Try refreshing the page.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="mt-2 text-[10px] text-red-800 bg-red-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
