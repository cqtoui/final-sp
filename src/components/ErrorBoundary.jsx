import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Application error:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reload the page to continue. If this keeps happening, check that
            the API is running and try again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium"
              onClick={() => this.setState({ hasError: false })}
            >
              Go to Live Monitor
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
