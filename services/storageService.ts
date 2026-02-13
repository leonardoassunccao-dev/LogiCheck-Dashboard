import { STORAGE_KEYS } from '../constants';
import { DriverIssue, ETrackRecord, ImportBatch, OperationalManifest, Theme } from '../types';

// --- UTILS ---

export const generateUUID = (): string => {
  // Prefer native crypto API if available (Secure Contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers or insecure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// --- WORKSPACE MANAGEMENT ---

const getWorkspaceId = (): string => {
  let wsId = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID);
  if (!wsId) {
    wsId = generateUUID();
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, wsId);
  }
  return wsId;
};

// Generates a dynamic key: e.g., "logicheck_data_550e8400-e29b..."
const getDynamicKey = (prefix: string): string => {
  const wsId = getWorkspaceId();
  return `${prefix}_${wsId}`;
};

export const StorageService = {
  // --- DEBUG / DIAGNOSTICS ---
  getDebugInfo: () => {
    const wsId = getWorkspaceId();
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('logicheck_'));
    const items: Record<string, string> = {};
    
    // Count items in current workspace
    const dataKey = `${STORAGE_KEYS.IMPORTED_DATA_PREFIX}_${wsId}`;
    const manifestsKey = `${STORAGE_KEYS.OPERATIONAL_MANIFESTS_PREFIX}_${wsId}`;
    const historyKey = `${STORAGE_KEYS.IMPORT_HISTORY_PREFIX}_${wsId}`;
    
    const dataRaw = localStorage.getItem(dataKey);
    const manifestsRaw = localStorage.getItem(manifestsKey);
    const histRaw = localStorage.getItem(historyKey);
    
    const totalRecordsStorage = dataRaw ? JSON.parse(dataRaw).length : 0;
    const totalManifestsStorage = manifestsRaw ? JSON.parse(manifestsRaw).length : 0;
    const totalBatchesStorage = histRaw ? JSON.parse(histRaw).length : 0;

    return {
      workspaceId: wsId,
      totalKeys: allKeys.length,
      keysList: allKeys,
      totalRecordsStorage,
      totalManifestsStorage,
      totalBatchesStorage,
      origin: window.location.origin,
      activeDataKey: dataKey
    };
  },

  // --- GLOBAL SETTINGS (Shared) ---
  getTheme: (): Theme => {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    return (theme === 'dark' || theme === 'light') ? theme : 'light';
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  // --- WORKSPACE ACTIONS ---

  // Forces a complete wipe of all application data using native clear()
  clearAllData: () => {
    try {
      console.warn('[Storage] INITIATING NUCLEAR DATA WIPE');
      
      // 1. Preserve Theme
      const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      
      // 2. NUKE EVERYTHING via Standard API
      localStorage.clear();

      // 3. Fallback: Manual Iteration (Brute Force)
      // Some environments might not clear correctly if there are locked keys (rare)
      if (localStorage.length > 0) {
        console.warn('[Storage] localStorage.clear() incomplete, attempting manual deletion');
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
           const k = localStorage.key(i);
           if (k) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      }
      
      // 4. Restore Theme
      if (currentTheme) {
        localStorage.setItem(STORAGE_KEYS.THEME, currentTheme);
      }
      
      console.warn('[Storage] NUCLEAR RESET COMPLETED. LocalStorage fully cleared.');
    } catch (e) {
      console.error('Failed to clear storage:', e);
      // Last resort: Attempt to remove known keys prefix
      Object.keys(localStorage).forEach(key => {
          if (key.includes('logicheck')) {
              localStorage.removeItem(key);
          }
      });
    }
  },

  resetWorkspace: (): string => {
    const newId = generateUUID();
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, newId);
    
    // Initialize new keys immediately to prevent read errors
    const dataKey = `${STORAGE_KEYS.IMPORTED_DATA_PREFIX}_${newId}`;
    const manifestsKey = `${STORAGE_KEYS.OPERATIONAL_MANIFESTS_PREFIX}_${newId}`;
    const historyKey = `${STORAGE_KEYS.IMPORT_HISTORY_PREFIX}_${newId}`;
    const issuesKey = `${STORAGE_KEYS.DRIVER_ISSUES_PREFIX}_${newId}`;
    
    localStorage.setItem(dataKey, JSON.stringify([]));
    localStorage.setItem(manifestsKey, JSON.stringify([]));
    localStorage.setItem(historyKey, JSON.stringify([]));
    localStorage.setItem(issuesKey, JSON.stringify([]));

    console.log(`[Storage] Workspace rotated. New ID: ${newId}`);
    return newId;
  },

  // --- DATA METHODS (Scoped to Workspace) ---

  getImportedData: (): ETrackRecord[] => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.IMPORTED_DATA_PREFIX);
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load imported data', e);
      return [];
    }
  },

  setImportedData: (data: ETrackRecord[]) => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.IMPORTED_DATA_PREFIX);
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`[Storage] Saved ${data.length} records to ${key}`);
    } catch (e) {
      alert('Erro de Armazenamento: Limite do navegador excedido. Execute "Limpar Todos os Dados".');
      console.error(e);
    }
  },

  getOperationalManifests: (): OperationalManifest[] => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.OPERATIONAL_MANIFESTS_PREFIX);
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load operational manifests', e);
      return [];
    }
  },

  setOperationalManifests: (data: OperationalManifest[]) => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.OPERATIONAL_MANIFESTS_PREFIX);
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save operational manifests', e);
    }
  },

  getImportHistory: (): ImportBatch[] => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.IMPORT_HISTORY_PREFIX);
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load import history', e);
      return [];
    }
  },

  setImportHistory: (history: ImportBatch[]) => {
    const key = getDynamicKey(STORAGE_KEYS.IMPORT_HISTORY_PREFIX);
    localStorage.setItem(key, JSON.stringify(history));
  },

  getDriverIssues: (): DriverIssue[] => {
    try {
      const key = getDynamicKey(STORAGE_KEYS.DRIVER_ISSUES_PREFIX);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load issues', e);
      return [];
    }
  },

  setDriverIssues: (issues: DriverIssue[]) => {
    const key = getDynamicKey(STORAGE_KEYS.DRIVER_ISSUES_PREFIX);
    localStorage.setItem(key, JSON.stringify(issues));
  },
};