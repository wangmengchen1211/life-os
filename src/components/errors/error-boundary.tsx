'use client';
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-[300px] flex flex-col items-center justify-center text-center px-8 py-12">
      <p className="text-lg font-light text-gray-600 mb-2">
        这里出了点小状况
      </p>
      <p className="text-sm text-gray-400 italic mb-6">
        刷新页面通常能解决问题
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-[#80cbc4] hover:underline"
        >
          刷新页面
        </button>
        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          重试
        </button>
      </div>
    </div>
  );
}
