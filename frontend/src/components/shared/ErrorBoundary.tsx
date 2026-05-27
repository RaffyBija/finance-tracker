import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <p className="error-boundary-icon">⚠️</p>
            <h2 className="error-boundary-title">Qualcosa è andato storto</h2>
            <p className="error-boundary-message">
              Si è verificato un errore imprevisto in questa pagina.
            </p>
            <button
              className="btn btn-primary btn-md"
              onClick={() => this.setState({ hasError: false })}
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
