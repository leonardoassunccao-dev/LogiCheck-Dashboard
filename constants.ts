import { LucideIcon, LayoutDashboard, AlertTriangle, Database } from 'lucide-react';
import { Tab } from './types';

// Keys now act as prefixes. The Service will append _{workspaceId}
export const STORAGE_KEYS = {
  WORKSPACE_ID: 'logicheck_current_workspace_id', // Stores the UUID of the active workspace
  THEME: 'logicheck_theme', // Theme is global, shared across workspaces
  
  // Dynamic Keys (Prefixes)
  IMPORTED_DATA_PREFIX: 'logicheck_data',
  IMPORT_HISTORY_PREFIX: 'logicheck_history',
  DRIVER_ISSUES_PREFIX: 'logicheck_issues',
};

export const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pendencias', label: 'Pendências', icon: AlertTriangle },
  { id: 'dados', label: 'Dados (Import)', icon: Database },
];

export const MARSALA = '#955251';