import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import DashboardTab from './components/DashboardTab';
import PendenciasTab from './components/PendenciasTab';
import ImportDataTab from './components/ImportDataTab';
import { StorageService } from './services/storageService';
import { AppState, Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<AppState>({
    theme: 'light',
    importedData: [],
    importHistory: [],
    driverIssues: [],
    isMeetingMode: false
  });

  // Handle Hash Navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as Tab;
      if (['dashboard', 'pendencias', 'dados'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Initial Load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedTheme = StorageService.getTheme();
    StorageService.setTheme(loadedTheme); 
    
    setState(prev => ({
      ...prev,
      theme: loadedTheme,
      importedData: StorageService.getImportedData(),
      importHistory: StorageService.getImportHistory(),
      driverIssues: StorageService.getDriverIssues()
    }));
  };

  const handleToggleTheme = () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setState(prev => ({ ...prev, theme: newTheme }));
    StorageService.setTheme(newTheme);
  };

  const handleToggleMeetingMode = () => {
    setState(prev => ({ ...prev, isMeetingMode: !prev.isMeetingMode }));
  };

  const updateImportData = (data: typeof state.importedData, history: typeof state.importHistory) => {
    setState(prev => ({ ...prev, importedData: data, importHistory: history }));
    StorageService.setImportedData(data);
    StorageService.setImportHistory(history);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab 
            data={state.importedData} 
            isMeetingMode={state.isMeetingMode}
            onToggleMeetingMode={handleToggleMeetingMode}
          />
        );
      case 'pendencias':
        return (
          <PendenciasTab 
            issues={state.driverIssues} 
            setIssues={(issues) => {
               setState(prev => ({ ...prev, driverIssues: issues }));
               StorageService.setDriverIssues(issues);
            }}
            importedData={state.importedData}
          />
        );
      case 'dados':
        return (
          <ImportDataTab 
            data={state.importedData} 
            history={state.importHistory}
            onDataUpdate={updateImportData}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      theme={state.theme}
      onToggleTheme={handleToggleTheme}
      isMeetingMode={state.isMeetingMode}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;