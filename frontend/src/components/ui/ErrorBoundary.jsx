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
        <div className="min-h-screen bg-[#F5F8FA] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#12304A]">Something went wrong</h2>
              <p className="text-xs text-slate-500">
                The application encountered an unexpected runtime error. Your clinical data remains secure.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="bg-slate-50 border border-slate-200 text-left p-3 rounded-xl text-xs text-slate-700 font-mono break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-300"
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
