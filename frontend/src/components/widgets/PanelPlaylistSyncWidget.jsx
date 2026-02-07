// PanelPlaylistSyncWidget.jsx
// Widget para sincronizar clientes dos painéis (Koffice/Sigma/Uniplay) com o Playlist Manager
// Busca cliente no painel, busca no Playlist Manager, e sincroniza a playlist

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, Settings, ChevronDown, ChevronUp, Search, Users, Tv,
  ArrowRight, Check, Loader2, X, AlertCircle, Coffee, Radio, Play,
  Monitor, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

export default function PanelPlaylistSyncWidget() {
  // UI State
  const [expanded, setExpanded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Config State
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    koffice_account_id: '',
    sigma_account_id: '',
    uniplay_account_id: ''
  });
  
  // Accounts lists
  const [kofficeAccounts, setKofficeAccounts] = useState([]);
  const [sigmaAccounts, setSigmaAccounts] = useState([]);
  const [uniplayAccounts, setUniplayAccounts] = useState([]);
  
  // Execution State
  const [selectedPanel, setSelectedPanel] = useState(null); // 'koffice' | 'sigma' | 'uniplay'
  
  // Search State
  const [panelSearch, setPanelSearch] = useState('');
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  
  const debouncedPanelSearch = useDebounce(panelSearch, 400);
  const debouncedPlaylistSearch = useDebounce(playlistSearch, 400);
  const debouncedGlobalSearch = useDebounce(globalSearch, 400);
  
  // Results State
  const [panelResults, setPanelResults] = useState([]);
  const [playlistResults, setPlaylistResults] = useState([]);
  const [searchingPanel, setSearchingPanel] = useState(false);
  const [searchingPlaylist, setSearchingPlaylist] = useState(false);
  
  // Selection State
  const [selectedPanelClient, setSelectedPanelClient] = useState(null);
  const [selectedPlaylistClient, setSelectedPlaylistClient] = useState(null);
  
  // Sync State
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  
  // ==================== LOAD CONFIG ====================
  
  useEffect(() => {
    loadConfig();
    loadAccounts();
  }, []);
  
  const loadConfig = async () => {
    try {
      const res = await api.get('/workflows/panel-playlist-sync/config');
      if (res.data.success && res.data.config) {
        setConfig(res.data.config);
        setConfigForm({
          koffice_account_id: res.data.config.koffice_account_id || '',
          sigma_account_id: res.data.config.sigma_account_id || '',
          uniplay_account_id: res.data.config.uniplay_account_id || ''
        });
      }
    } catch (err) {
      // Config não existe ainda, ok
    } finally {
      setLoading(false);
    }
  };
  
  const loadAccounts = async () => {
    try {
      const [kofficeRes, sigmaRes, uniplayRes] = await Promise.all([
        api.get('/koffice/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/sigma/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/uniplay/accounts').catch(() => ({ data: { accounts: [] } }))
      ]);
      
      setKofficeAccounts(kofficeRes.data.accounts || []);
      setSigmaAccounts(sigmaRes.data.accounts || []);
      setUniplayAccounts(uniplayRes.data.accounts || []);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  };
  
  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await api.post('/workflows/panel-playlist-sync/config', configForm);
      if (res.data.success) {
        setConfig(res.data.config);
        setShowConfig(false);
        toast.success('Configuração salva!');
      }
    } catch (err) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };
  
  // ==================== SEARCH FUNCTIONS ====================
  
  // Search Panel (Koffice/Sigma/Uniplay)
  const searchPanel = useCallback(async (query) => {
    if (!query || query.length < 2 || !selectedPanel || !config) {
      setPanelResults([]);
      return;
    }
    
    setSearchingPanel(true);
    try {
      let results = [];
      
      if (selectedPanel === 'koffice' && config.koffice_account_id) {
        const res = await api.get(`/koffice/accounts/${config.koffice_account_id}/clients/search?q=${encodeURIComponent(query)}`);
        if (res.data.success) {
          results = (res.data.clients || []).map(c => ({
            id: c.id,
            name: c.notes || c.note || `User: ${c.username}`,
            username: c.username,
            expiry: c.expiry || c.exp_date,
            raw: c
          }));
        }
      } else if (selectedPanel === 'sigma' && config.sigma_account_id) {
        const res = await api.get(`/sigma/accounts/${config.sigma_account_id}/customers?search=${encodeURIComponent(query)}&perPage=20`);
        if (res.data.success) {
          results = (res.data.customers || []).map(c => ({
            id: c.id,
            name: c.note || c.username,
            username: c.username,
            expiry: c.expires_at,
            raw: c
          }));
        }
      } else if (selectedPanel === 'uniplay' && config.uniplay_account_id) {
        const res = await api.get(`/uniplay/accounts/${config.uniplay_account_id}/clients/search?name=${encodeURIComponent(query)}`);
        if (res.data.success && res.data.found) {
          const client = res.data.client;
          results = [{
            id: client.id,
            name: client.nome || client.name,
            username: client.usuario || client.username,
            expiry: client.validade,
            type: client.type,
            raw: client
          }];
          // Add similar results
          if (res.data.similar) {
            res.data.similar.forEach(c => {
              results.push({
                id: c.id,
                name: c.nome || c.name,
                username: c.usuario || c.username,
                expiry: c.validade,
                type: c.type,
                raw: c
              });
            });
          }
        }
      }
      
      setPanelResults(results);
    } catch (err) {
      console.error('Erro ao buscar no painel:', err);
      setPanelResults([]);
    } finally {
      setSearchingPanel(false);
    }
  }, [selectedPanel, config]);
  
  // Search Playlist Manager
  const searchPlaylist = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setPlaylistResults([]);
      return;
    }
    
    setSearchingPlaylist(true);
    try {
      const res = await api.get(`/playlist/clients/search?q=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setPlaylistResults(res.data.clients || []);
      }
    } catch (err) {
      console.error('Erro ao buscar no Playlist Manager:', err);
      setPlaylistResults([]);
    } finally {
      setSearchingPlaylist(false);
    }
  }, []);
  
  // Effect: Panel search
  useEffect(() => {
    const query = globalSearch || panelSearch;
    searchPanel(query);
  }, [debouncedPanelSearch, debouncedGlobalSearch, searchPanel]);
  
  // Effect: Playlist search
  useEffect(() => {
    const query = globalSearch || playlistSearch;
    searchPlaylist(query);
  }, [debouncedPlaylistSearch, debouncedGlobalSearch, searchPlaylist]);
  
  // ==================== GET M3U FROM PANEL ====================
  
  const getM3UFromPanel = async (client) => {
    if (!selectedPanel || !config) return null;
    
    try {
      if (selectedPanel === 'koffice' && config.koffice_account_id) {
        const res = await api.get(`/koffice/accounts/${config.koffice_account_id}/clients/${client.id}/data`);
        if (res.data.success) {
          // Extrair M3U do rawMessage usando regex TS
          let m3uUrl = res.data.m3uUrl || null;
          
          if (!m3uUrl && res.data.rawMessage) {
            const patterns = [
              /TS\s*-?\s*(https?:\/\/[^\s\*<\n]+)/i,
              /M3U[:\s]+\*?(https?:\/\/[^\s\*<]+)/i,
              /(https?:\/\/[^\s<]+get\.php[^\s<]*)/i
            ];
            
            for (const pattern of patterns) {
              const match = res.data.rawMessage.match(pattern);
              if (match) {
                m3uUrl = match[1].trim();
                break;
              }
            }
          }
          
          // Fallback para shortUrl
          if (!m3uUrl) {
            m3uUrl = res.data.shortUrl;
          }
          
          return m3uUrl;
        }
      } else if (selectedPanel === 'sigma' && config.sigma_account_id) {
        // Buscar playlist via API - retorna array de templates
        const res = await api.get(`/sigma/accounts/${config.sigma_account_id}/customers/${client.id}/playlist`);
        if (res.data.success) {
          const playlist = res.data.playlist;
          console.log('[Sigma] Playlist response:', playlist);
          
          // A API retorna array de templates por idioma
          // Precisamos extrair a URL M3U do texto do template
          if (Array.isArray(playlist)) {
            // Preferir template em português
            const ptTemplate = playlist.find(t => t.key === 'pt');
            const template = ptTemplate?.template || playlist[0]?.template || '';
            
            if (template) {
              // Extrair URL M3U do texto do template
              const patterns = [
                /\*?Link \(M3U COMPLETO\)\:?\*?\s*(https?:\/\/[^\s\n]+)/i,
                /M3U COMPLETO[:\s\-\*]*(https?:\/\/[^\s\n]+)/i,
                /(https?:\/\/[^\s\n]+get\.php\?[^\s\n]*type=m3u[^\s\n]*)/i,
                /(https?:\/\/[^\s\n]+get\.php\?username=[^\s\n]+)/i
              ];
              
              for (const pattern of patterns) {
                const match = template.match(pattern);
                if (match) {
                  const m3uUrl = match[1].trim();
                  console.log('[Sigma] URL extraída do template:', m3uUrl);
                  return m3uUrl;
                }
              }
            }
          }
          
          // Fallback: se playlist for objeto com URL direta
          if (typeof playlist === 'object' && !Array.isArray(playlist)) {
            const m3uUrl = playlist?.m3u_url || 
                           playlist?.m3u8_url || 
                           playlist?.url || 
                           playlist?.playlist_url ||
                           playlist?.link;
            if (m3uUrl) return m3uUrl;
          }
          
          // Fallback: se playlist for string direta
          if (typeof playlist === 'string' && playlist.startsWith('http')) {
            return playlist;
          }
        }
        
        return null;
      } else if (selectedPanel === 'uniplay' && config.uniplay_account_id) {
        const res = await api.get(`/uniplay/accounts/${config.uniplay_account_id}/clients/${client.id}/links`);
        if (res.data.success) {
          const links = res.data.links;
          return links?.m3u8 || links?.m3u8Short || links?.m3u || links?.url;
        }
      }
    } catch (err) {
      console.error('Erro ao obter M3U:', err);
    }
    
    return null;
  };
  
  // ==================== SYNC FUNCTION ====================
  
  const handleSync = async () => {
    if (!selectedPanelClient || !selectedPlaylistClient) {
      toast.error('Selecione um cliente em cada lado');
      return;
    }
    
    setSyncing(true);
    setSyncResult(null);
    const toastId = toast.loading('Sincronizando...');
    
    try {
      // 1. Obter M3U do painel
      toast.loading('Obtendo playlist do painel...', { id: toastId });
      const m3uUrl = await getM3UFromPanel(selectedPanelClient);
      
      if (!m3uUrl) {
        throw new Error('Não foi possível obter a URL M3U do cliente');
      }
      
      // 2. Listar playlists existentes no Playlist Manager
      toast.loading('Fazendo login no player...', { id: toastId });
      const playlistsRes = await api.get(`/playlist/clients/${selectedPlaylistClient.id}/playlists`);
      
      if (!playlistsRes.data.success) {
        throw new Error('Erro ao fazer login no player');
      }
      
      const existingPlaylists = playlistsRes.data.playlists || [];
      
      // 3. Deletar todas as playlists existentes
      if (existingPlaylists.length > 0) {
        toast.loading(`Removendo ${existingPlaylists.length} playlist(s) existente(s)...`, { id: toastId });
        
        for (const playlist of existingPlaylists) {
          try {
            await api.delete(`/playlist/clients/${selectedPlaylistClient.id}/playlists/${playlist.id}`);
          } catch (delErr) {
            console.warn('Não conseguiu deletar playlist:', playlist.name, delErr.message);
            // Continuar mesmo se falhar
          }
        }
      }
      
      // 4. Criar nova playlist "TV"
      toast.loading('Criando playlist TV...', { id: toastId });
      const createRes = await api.post(`/playlist/clients/${selectedPlaylistClient.id}/playlists`, {
        name: 'TV',
        url: m3uUrl,
        type: 'general'
      });
      
      if (!createRes.data.success) {
        throw new Error('Erro ao criar playlist');
      }
      
      // Sucesso!
      toast.success('Sincronização concluída!', { id: toastId });
      
      setSyncResult({
        success: true,
        panelClient: selectedPanelClient,
        playlistClient: selectedPlaylistClient,
        m3uUrl,
        deletedCount: existingPlaylists.length
      });
      
    } catch (err) {
      console.error('Erro na sincronização:', err);
      toast.error(err.message || 'Erro ao sincronizar', { id: toastId });
      setSyncResult({
        success: false,
        error: err.message
      });
    } finally {
      setSyncing(false);
    }
  };
  
  // ==================== RESET ====================
  
  const handleReset = () => {
    setSelectedPanelClient(null);
    setSelectedPlaylistClient(null);
    setPanelResults([]);
    setPlaylistResults([]);
    setPanelSearch('');
    setPlaylistSearch('');
    setGlobalSearch('');
    setSyncResult(null);
  };
  
  // ==================== RENDER ====================
  
  const isConfigured = config && (config.koffice_account_id || config.sigma_account_id || config.uniplay_account_id);
  
  const availablePanels = {
    koffice: config?.koffice_account_id,
    sigma: config?.sigma_account_id,
    uniplay: config?.uniplay_account_id
  };
  
  const panelIcons = {
    koffice: Coffee,
    sigma: Radio,
    uniplay: Play
  };
  
  const panelColors = {
    koffice: 'cyan',
    sigma: 'violet',
    uniplay: 'blue'
  };
  
  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-emerald-500" />
            </div>
            <ArrowRight size={14} className="text-text-muted" />
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Tv size={18} className="text-cyan-500" />
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-text-primary">Painel → Playlist Manager</h3>
            <p className="text-xs text-text-muted">Sincronizar cliente existente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfig(!showConfig); }}
              className={`p-2 rounded-lg transition-colors ${
                showConfig ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 text-text-muted'
              }`}
            >
              <Settings size={18} />
            </button>
          )}
          {expanded ? (
            <ChevronUp size={20} className="text-text-muted" />
          ) : (
            <ChevronDown size={20} className="text-text-muted" />
          )}
        </div>
      </button>
      
      {/* Content */}
      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : showConfig ? (
            /* ========== MODO CONFIGURAÇÃO ========== */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Settings size={16} />
                <span className="font-semibold">Configuração</span>
              </div>
              
              {/* Koffice */}
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                  <Coffee size={14} />
                  Koffice
                </div>
                <select
                  value={configForm.koffice_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, koffice_account_id: e.target.value }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Nenhuma</option>
                  {kofficeAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Sigma */}
              <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <Radio size={14} />
                  Sigma
                </div>
                <select
                  value={configForm.sigma_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, sigma_account_id: e.target.value }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Nenhuma</option>
                  {sigmaAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Uniplay */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                  <Play size={14} />
                  Uniplay
                </div>
                <select
                  value={configForm.uniplay_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, uniplay_account_id: e.target.value }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Nenhuma</option>
                  {uniplayAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={saveConfig}
                disabled={saving}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Salvar Configuração
              </button>
            </div>
          ) : !isConfigured ? (
            /* ========== NÃO CONFIGURADO ========== */
            <div className="text-center py-6">
              <Settings size={40} className="mx-auto text-emerald-500/50 mb-3" />
              <p className="text-text-muted mb-3">Configure as contas primeiro</p>
              <button
                onClick={() => setShowConfig(true)}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
              >
                Configurar
              </button>
            </div>
          ) : syncResult?.success ? (
            /* ========== RESULTADO SUCESSO ========== */
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Check size={20} className="text-emerald-500" />
                <span className="font-semibold text-emerald-400">Sincronização Concluída!</span>
              </div>
              <div className="space-y-1 text-sm text-text-secondary">
                <p>✅ Origem: <strong className="text-text-primary">{syncResult.panelClient?.name}</strong></p>
                <p>✅ Destino: <strong className="text-text-primary">{syncResult.playlistClient?.name}</strong></p>
                {syncResult.deletedCount > 0 && (
                  <p>🗑️ Playlists removidas: {syncResult.deletedCount}</p>
                )}
                <p>📺 Playlist "TV" criada</p>
              </div>
              <button
                onClick={handleReset}
                className="mt-4 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
              >
                Nova Sincronização
              </button>
            </div>
          ) : (
            /* ========== MODO EXECUÇÃO ========== */
            <div className="space-y-4">
              {/* Seleção de Painel */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">
                  Selecionar Painel de Origem
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['koffice', 'sigma', 'uniplay'].map(panel => {
                    const Icon = panelIcons[panel];
                    const color = panelColors[panel];
                    const available = availablePanels[panel];
                    
                    return (
                      <button
                        key={panel}
                        onClick={() => available && setSelectedPanel(panel)}
                        disabled={!available}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          selectedPanel === panel
                            ? `border-${color}-500 bg-${color}-500/20`
                            : available
                              ? `border-border-color hover:border-${color}-500/50 bg-bg-tertiary`
                              : 'border-border-color bg-bg-tertiary opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <Icon size={20} className={`mx-auto mb-1 ${
                          selectedPanel === panel ? `text-${color}-400` : 'text-text-muted'
                        }`} />
                        <p className={`text-xs font-medium capitalize ${
                          selectedPanel === panel ? `text-${color}-400` : 'text-text-muted'
                        }`}>
                          {panel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {selectedPanel && (
                <>
                  {/* Busca Global */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-2">
                      <Search size={12} className="inline mr-1" />
                      Busca Geral (nos dois)
                    </label>
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      placeholder="Buscar em ambos..."
                      className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                    />
                  </div>
                  
                  {/* Duas colunas de busca */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Coluna Painel */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-text-muted">
                        📦 {selectedPanel.charAt(0).toUpperCase() + selectedPanel.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={panelSearch}
                        onChange={(e) => setPanelSearch(e.target.value)}
                        placeholder="Buscar cliente..."
                        disabled={!!globalSearch}
                        className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary disabled:opacity-50"
                      />
                      
                      {/* Resultados do Painel */}
                      <div className="bg-bg-tertiary rounded-lg border border-border-color max-h-40 overflow-y-auto">
                        {searchingPanel ? (
                          <div className="p-3 text-center">
                            <Loader2 size={16} className="animate-spin mx-auto text-text-muted" />
                          </div>
                        ) : panelResults.length === 0 ? (
                          <div className="p-3 text-center text-xs text-text-muted">
                            {(panelSearch || globalSearch) ? 'Nenhum resultado' : 'Digite para buscar'}
                          </div>
                        ) : (
                          panelResults.map(client => (
                            <button
                              key={client.id}
                              onClick={() => setSelectedPanelClient(client)}
                              className={`w-full p-2 text-left border-b border-border-color last:border-0 hover:bg-white/5 transition-colors ${
                                selectedPanelClient?.id === client.id ? 'bg-emerald-500/20' : ''
                              }`}
                            >
                              <p className="text-sm font-medium text-text-primary truncate">
                                {client.name}
                              </p>
                              <p className="text-xs text-text-muted truncate">
                                {client.username}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    
                    {/* Coluna Playlist Manager */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-text-muted">
                        📱 Playlist Manager
                      </label>
                      <input
                        type="text"
                        value={playlistSearch}
                        onChange={(e) => setPlaylistSearch(e.target.value)}
                        placeholder="Nome ou MAC..."
                        disabled={!!globalSearch}
                        className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary disabled:opacity-50"
                      />
                      
                      {/* Resultados do Playlist Manager */}
                      <div className="bg-bg-tertiary rounded-lg border border-border-color max-h-40 overflow-y-auto">
                        {searchingPlaylist ? (
                          <div className="p-3 text-center">
                            <Loader2 size={16} className="animate-spin mx-auto text-text-muted" />
                          </div>
                        ) : playlistResults.length === 0 ? (
                          <div className="p-3 text-center text-xs text-text-muted">
                            {(playlistSearch || globalSearch) ? 'Nenhum resultado' : 'Digite para buscar'}
                          </div>
                        ) : (
                          playlistResults.map(client => (
                            <button
                              key={client.id}
                              onClick={() => setSelectedPlaylistClient(client)}
                              className={`w-full p-2 text-left border-b border-border-color last:border-0 hover:bg-white/5 transition-colors ${
                                selectedPlaylistClient?.id === client.id ? 'bg-cyan-500/20' : ''
                              }`}
                            >
                              <p className="text-sm font-medium text-text-primary truncate">
                                {client.name}
                              </p>
                              <p className="text-xs text-text-muted truncate font-mono">
                                {client.mac_address}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Seleção atual */}
                  {(selectedPanelClient || selectedPlaylistClient) && (
                    <div className="p-3 bg-bg-tertiary rounded-xl border border-border-color">
                      <p className="text-xs text-text-muted mb-2">Selecionado:</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={selectedPanelClient ? 'text-emerald-400' : 'text-text-muted'}>
                          {selectedPanelClient?.name || '—'}
                        </span>
                        <ArrowRight size={14} className="text-text-muted" />
                        <span className={selectedPlaylistClient ? 'text-cyan-400' : 'text-text-muted'}>
                          {selectedPlaylistClient?.name || '—'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Aviso */}
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-xs text-amber-400">
                      ⚠️ Isso vai <strong>apagar todas as playlists</strong> do cliente selecionado e criar uma nova chamada "TV"
                    </p>
                  </div>
                  
                  {/* Botão Sincronizar */}
                  <button
                    onClick={handleSync}
                    disabled={!selectedPanelClient || !selectedPlaylistClient || syncing}
                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} />
                        Sincronizar
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}