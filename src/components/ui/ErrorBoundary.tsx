import React from 'react';

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err: any) { return { error: err }; }
  componentDidCatch(err: any, info: any) { console.error("CRM Error:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-xl font-bold text-red-400">Something crashed</h2>
            <p className="text-white/60 text-sm">{this.state.error?.message || "Unknown error"}</p>
            <button onClick={() => this.setState({ error: null })} className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition">
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const SafePage = ({ children }: any) => <ErrorBoundary>{children}</ErrorBoundary>;
