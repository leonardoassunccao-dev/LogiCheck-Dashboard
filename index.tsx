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

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Runtime Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: '#1f2937' }}>
          <h1 style={{ color: '#955251', marginBottom: '16px' }}>Ops! Algo deu errado.</h1>
          <p style={{ marginBottom: '24px', color: '#4b5563' }}>
            O sistema encontrou um erro inesperado. Tente recarregar a página ou limpar os dados locais.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#fff', 
                color: '#955251', 
                border: '1px solid #955251', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold' 
              }}
            >
              Recarregar
            </button>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#955251', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold' 
              }}
            >
              Limpar Dados (Reset)
            </button>
          </div>
          {this.state.error && (
            <pre style={{ 
              marginTop: '20px', 
              padding: '10px', 
              backgroundColor: '#f3f4f6', 
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'left',
              overflow: 'auto',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
