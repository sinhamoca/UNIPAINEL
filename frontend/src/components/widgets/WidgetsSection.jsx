// components/widgets/WidgetsSection.jsx
// Seção de Widgets de Sincronização no Dashboard

import { RefreshCw } from 'lucide-react';
import SyncKofficeIboWidget from './SyncKofficeIboWidget';
import SyncSigmaIboWidget from './SyncSigmaIboWidget';
import SyncUniplayIboWidget from './SyncUniplayIboWidget';
import TrialPlaylistWidget from './TrialPlaylistWidget';
import PanelPlaylistSyncWidget from './PanelPlaylistSyncWidget';  // ← NOVO

export default function WidgetsSection() {
  return (
    <div className="mb-8">
      {/* Header da seção */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-xl flex items-center justify-center">
          <RefreshCw size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Sincronização Rápida</h2>
          <p className="text-sm text-text-muted">Widgets para transferir dados entre sistemas</p>
        </div>
      </div>
      
      {/* Grid de Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Linha 1: Widgets de Sync com IBO */}
        <SyncKofficeIboWidget />
        <SyncSigmaIboWidget />
        
        {/* Linha 2: Uniplay + Trial/Playlist */}
        <SyncUniplayIboWidget />
        <TrialPlaylistWidget />
        
        {/* NOVO: Widget Painel → Playlist Manager */}
        <PanelPlaylistSyncWidget />
      </div>
    </div>
  );
}