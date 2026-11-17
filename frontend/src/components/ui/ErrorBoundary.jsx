import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Standard Application Error Boundary
 * Catches unhandled JavaScript runtime exceptions in child component trees
 * and presents a resilient fallback UI instead of crashing the entire viewport.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Application Exception caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F8FA] dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xl max-w-lg w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-800">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#12304A] dark:text-gray-100">Something went wrong</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                The application encountered an unexpected runtime error. Your clinical data remains secure.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-left p-3 rounded-xl text-xs text-slate-700 dark:text-gray-300 font-mono break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-gray-600"
              >
                <Home className="w-3.5 h-3.5" />
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
