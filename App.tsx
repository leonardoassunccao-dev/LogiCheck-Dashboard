import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import DashboardTab from './components/DashboardTab';
import PendenciasTab from './components/PendenciasTab';
import RomaneiosTab from './components/RomaneiosTab';
import ImportDataTab from './components/ImportDataTab';
import { StorageService } from './services/storageService';
import { AppState, Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<AppState>({
    theme: 'light',
    importedData: [],
    operationalManifests: [], // Initialize new state
    importHistory: [],
    driverIssues: [],
    isMeetingMode: false
  });

  // Handle Hash Navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as Tab;
      if (['dashboard', 'pendencias', 'romaneios', 'dados'].includes(hash)) {
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
      operationalManifests: StorageService.getOperationalManifests(), // Load new data
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

  const updateImportData = (data: typeof state.importedData, manifests: typeof state.operationalManifests, history: typeof state.importHistory) => {
    setState(prev => ({ ...prev, importedData: data, operationalManifests: manifests, importHistory: history }));
    StorageService.setImportedData(data);
    StorageService.setOperationalManifests(manifests); // Save new data
    StorageService.setImportHistory(history);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab 
            data={state.importedData} 
            manifests={state.operationalManifests}
            isMeetingMode={state.isMeetingMode}
            onToggleMeetingMode={handleToggleMeetingMode}
          />
        );
      case 'romaneios':
        return (
          <RomaneiosTab manifests={state.operationalManifests} />
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
            manifests={state.operationalManifests} 
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