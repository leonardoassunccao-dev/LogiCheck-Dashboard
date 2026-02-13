import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Fixed ErrorBoundary by explicitly extending React.Component and declaring the state property
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Declare the state property explicitly to resolve "Property 'state' does not exist" errors
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    // Accessing this.state is now correctly typed
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#800020', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'black' }}>Algo deu errado.</h1>
          <p style={{ margin: '10px 0', opacity: 0.7 }}>A aplicação encontrou um erro inesperado e não pôde continuar.</p>
          <pre style={{ backgroundColor: '#f9f9f9', padding: '20px', overflow: 'auto', borderRadius: '12px', textAlign: 'left', border: '1px solid #eee', fontSize: '11px' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: '20px', padding: '12px 30px', backgroundColor: '#955251', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Resetar App e Recarregar
          </button>
        </div>
      );
    }

    // Accessing this.props is now correctly typed through React.Component inheritance
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('SW fail: ', err));
  });
}
