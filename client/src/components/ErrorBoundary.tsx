import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen gradient-bg text-white">
          <div className="text-center">
            <h2 className="text-xl mb-2">出了点问题</h2>
            <button
              className="px-4 py-2 bg-biu-primary rounded-lg hover:bg-biu-secondary transition"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
