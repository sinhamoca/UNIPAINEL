// components/widgets/SyncKofficeIboWidget.jsx
// Widget de Sincronização Koffice → IBO Revenda

import { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Search, Server, Users, ArrowRight, Check, 
  Loader2, X, ChevronDown, ChevronUp, Link2, AlertCircle 
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

export default function SyncKofficeIboWidget() {
  // Estado de expansão do widget
  const [expanded, setExpanded] = useState(false);
  
  // Contas disponíveis
  const [kofficeAccounts, setKofficeAccounts] = useState([]);
  const [iboAccounts, setIboAccounts] = useState([]);
  
  // Contas selecionadas
  const [selectedKoffice, setSelectedKoffice] = useState('');
  const [selectedIbo, setSelectedIbo] = useState('');
  
  // Pesquisa e resultados - Koffice
  const [kofficeSearch, setKofficeSearch] = useState('');
  const [kofficeResults, setKofficeResults] = useState([]);
  const [kofficeLoading, setKofficeLoading] = useState(false);
  const [selectedKofficeClient, setSelectedKofficeClient] = useState(null);
  
  // Pesquisa e resultados - IBO
  const [iboSearch, setIboSearch] = useState('');
  const [iboResults, setIboResults] = useState([]);
  const [iboLoading, setIboLoading] = useState(false);
  const [selectedIboClient, setSelectedIboClient] = useState(null);
  
  // Busca global (ambos sistemas)
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);
  
  // Execução
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  
  // Debounced searches
  const debouncedKofficeSearch = useDebounce(kofficeSearch, 500);
  const debouncedIboSearch = useDebounce(iboSearch, 500);
  const debouncedGlobalSearch = useDebounce(globalSearch, 500);
  
  // Carregar contas ao montar
  useEffect(() => {
    loadAccounts();
  }, []);
  
  const loadAccounts = async () => {
    try {
      const [kofficeRes, iboRes] = await Promise.all([
        api.get('/koffice/accounts'),
        api.get('/gerencia/accounts')
      ]);
      setKofficeAccounts(kofficeRes.data.accounts || []);
      setIboAccounts(iboRes.data.accounts || []);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  };
  
  // Buscar clientes Koffice
  useEffect(() => {
    if (debouncedKofficeSearch && debouncedKofficeSearch.length >= 2 && selectedKoffice) {
      searchKoffice(debouncedKofficeSearch);
    } else {
      setKofficeResults([]);
    }
  }, [debouncedKofficeSearch, selectedKoffice]);
  
  const searchKoffice = async (term) => {
    setKofficeLoading(true);
    try {
      const res = await api.get(`/koffice/accounts/${selectedKoffice}/clients/search?q=${encodeURIComponent(term)}&limit=10`);
      setKofficeResults(res.data.clients || []);
    } catch (err) {
      console.error('Erro ao buscar Koffice:', err);
      setKofficeResults([]);
    } finally {
      setKofficeLoading(false);
    }
  };
  
  // Buscar clientes IBO
  useEffect(() => {
    if (debouncedIboSearch && debouncedIboSearch.length >= 2 && selectedIbo) {
      searchIbo(debouncedIboSearch);
    } else {
      setIboResults([]);
    }
  }, [debouncedIboSearch, selectedIbo]);
  
  const searchIbo = async (term) => {
    setIboLoading(true);
    try {
      const res = await api.get(`/gerencia/accounts/${selectedIbo}/users?search=${encodeURIComponent(term)}`);
      setIboResults(res.data.users || []);
    } catch (err) {
      console.error('Erro ao buscar IBO:', err);
      setIboResults([]);
    } finally {
      setIboLoading(false);
    }
  };
  
  // Busca global (ambos sistemas)
  useEffect(() => {
    if (debouncedGlobalSearch && debouncedGlobalSearch.length >= 2 && selectedKoffice && selectedIbo) {
      searchGlobal(debouncedGlobalSearch);
    }
  }, [debouncedGlobalSearch, selectedKoffice, selectedIbo]);
  
  const searchGlobal = async (term) => {
    setGlobalLoading(true);
    try {
      const [kofficeRes, iboRes] = await Promise.all([
        api.get(`/koffice/accounts/${selectedKoffice}/clients/search?q=${encodeURIComponent(term)}&limit=10`),
        api.get(`/gerencia/accounts/${selectedIbo}/users?search=${encodeURIComponent(term)}`)
      ]);
      
      setKofficeResults(kofficeRes.data.clients || []);
      setIboResults(iboRes.data.users || []);
      
      // Auto-selecionar se encontrou exatamente 1 em cada
      const kClients = kofficeRes.data.clients || [];
      const iClients = iboRes.data.users || [];
      
      if (kClients.length === 1) {
        setSelectedKofficeClient(kClients[0]);
      }
      if (iClients.length === 1) {
        setSelectedIboClient(iClients[0]);
      }
      
    } catch (err) {
      console.error('Erro na busca global:', err);
    } finally {
      setGlobalLoading(false);
    }
  };
  
  // Buscar M3U do cliente Koffice via endpoint /data (fast_message)
  const fetchKofficeM3U = async (accountId, clientId) => {
    try {
      const res = await api.get(`/koffice/accounts/${accountId}/clients/${clientId}/data`);
      if (res.data.success) {
        // extractFastMessageData retorna: { m3uUrl, shortUrl, ... }
        return res.data.m3uUrl || res.data.shortUrl || null;
      }
      return null;
    } catch (err) {
      console.error('Erro ao buscar M3U:', err);
      return null;
    }
  };
  
  // Executar sincronização
  const handleSync = async () => {
    if (!selectedKofficeClient || !selectedIboClient) {
      toast.error('Selecione os clientes em ambos os sistemas');
      return;
    }
    
    setExecuting(true);
    
    try {
      // Buscar M3U do cliente Koffice via fast_message
      const m3uUrl = await fetchKofficeM3U(selectedKoffice, selectedKofficeClient.id);
      
      if (!m3uUrl) {
        toast.error('Não foi possível obter M3U do cliente Koffice. Verifique se está ativo.');
        return;
      }
      
      // Atualizar apenas a playlist do cliente IBO
      const res = await api.put(`/gerencia/accounts/${selectedIbo}/users/${selectedIboClient.id}`, {
        m3u8_list: m3uUrl
      });
      
      if (res.data.success) {
        setResult({
          success: true,
          kofficeClient: selectedKofficeClient.name || selectedKofficeClient.username,
          iboClient: selectedIboClient.server_name,
          playlist: m3uUrl
        });
        toast.success('Playlist sincronizada com sucesso!');
      } else {
        toast.error(res.data.error || 'Erro ao sincronizar');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao sincronizar');
    } finally {
      setExecuting(false);
    }
  };
  
  // Reset
  const handleReset = () => {
    setSelectedKofficeClient(null);
    setSelectedIboClient(null);
    setKofficeSearch('');
    setIboSearch('');
    setGlobalSearch('');
    setKofficeResults([]);
    setIboResults([]);
    setResult(null);
  };
  
  // Verificar se pode executar
  const canExecute = selectedKoffice && selectedIbo && selectedKofficeClient && selectedIboClient;

  return (
    <div className="bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/30 rounded-2xl overflow-hidden">
      {/* Header - Sempre visível */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Server size={18} className="text-cyan-500" />
            </div>
            <ArrowRight size={14} className="text-text-muted" />
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-emerald-500" />
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-text-primary">Sincronizar Koffice → IBO</h3>
            <p className="text-xs text-text-muted">Transferir playlist entre sistemas</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
      </button>
      
      {/* Conteúdo expandido */}
      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Resultado de sucesso */}
          {result && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Check size={20} className="text-emerald-500" />
                <span className="font-semibold text-emerald-400">Sincronizado!</span>
              </div>
              <p className="text-sm text-text-secondary">
                Playlist de <strong>{result.kofficeClient}</strong> copiada para <strong>{result.iboClient}</strong>
              </p>
              <button
                onClick={handleReset}
                className="mt-3 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
              >
                Nova Sincronização
              </button>
            </div>
          )}
          
          {!result && (
            <>
              {/* Seleção de contas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Conta Koffice</label>
                  <select
                    value={selectedKoffice}
                    onChange={(e) => {
                      setSelectedKoffice(e.target.value);
                      setSelectedKofficeClient(null);
                      setKofficeResults([]);
                    }}
                    className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary focus:border-cyan-500 transition-fast"
                  >
                    <option value="">Selecione...</option>
                    {kofficeAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Conta IBO Revenda</label>
                  <select
                    value={selectedIbo}
                    onChange={(e) => {
                      setSelectedIbo(e.target.value);
                      setSelectedIboClient(null);
                      setIboResults([]);
                    }}
                    className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary focus:border-emerald-500 transition-fast"
                  >
                    <option value="">Selecione...</option>
                    {iboAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Busca Global */}
              {selectedKoffice && selectedIbo && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1">
                    <Search size={12} />
                    Busca Global (ambos sistemas)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      placeholder="Digite o nome do cliente..."
                      className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 pr-10 text-sm text-text-primary focus:border-amber-500 transition-fast"
                    />
                    {globalLoading && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-500" />
                    )}
                  </div>
                </div>
              )}
              
              {/* Pesquisas individuais */}
              <div className="grid grid-cols-2 gap-3">
                {/* Koffice */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Server size={14} className="text-cyan-500" />
                    <span className="text-xs font-medium text-text-muted">Cliente Koffice</span>
                  </div>
                  
                  {selectedKoffice ? (
                    <>
                      {!selectedKofficeClient ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              value={kofficeSearch}
                              onChange={(e) => setKofficeSearch(e.target.value)}
                              placeholder="Buscar cliente..."
                              className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 pr-8 text-sm text-text-primary focus:border-cyan-500 transition-fast"
                            />
                            {kofficeLoading && (
                              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-500" />
                            )}
                          </div>
                          
                          {/* Resultados Koffice */}
                          {kofficeResults.length > 0 && (
                            <div className="bg-bg-tertiary border border-border-color rounded-lg max-h-40 overflow-y-auto">
                              {kofficeResults.map(client => (
                                <button
                                  key={client.id}
                                  onClick={() => setSelectedKofficeClient(client)}
                                  className="w-full p-2 text-left hover:bg-cyan-500/10 transition-colors border-b border-border-color last:border-b-0"
                                >
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {client.name || client.notes || client.username}
                                  </p>
                                  <p className="text-xs text-text-muted truncate">
                                    {client.username} • {client.status}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-cyan-400 truncate">
                                {selectedKofficeClient.name || selectedKofficeClient.notes}
                              </p>
                              <p className="text-xs text-text-muted">{selectedKofficeClient.username}</p>
                            </div>
                            <button
                              onClick={() => setSelectedKofficeClient(null)}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <X size={14} className="text-red-400" />
                            </button>
                          </div>
                          {/* M3U será buscado ao sincronizar */}
                          <div className="mt-1 text-xs text-text-muted">
                            M3U será carregado ao sincronizar
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-text-muted p-2 bg-bg-tertiary rounded-lg">
                      Selecione uma conta
                    </p>
                  )}
                </div>
                
                {/* IBO */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-emerald-500" />
                    <span className="text-xs font-medium text-text-muted">Cliente IBO</span>
                  </div>
                  
                  {selectedIbo ? (
                    <>
                      {!selectedIboClient ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              value={iboSearch}
                              onChange={(e) => setIboSearch(e.target.value)}
                              placeholder="Buscar cliente..."
                              className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 pr-8 text-sm text-text-primary focus:border-emerald-500 transition-fast"
                            />
                            {iboLoading && (
                              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-500" />
                            )}
                          </div>
                          
                          {/* Resultados IBO */}
                          {iboResults.length > 0 && (
                            <div className="bg-bg-tertiary border border-border-color rounded-lg max-h-40 overflow-y-auto">
                              {iboResults.map(client => (
                                <button
                                  key={client.id}
                                  onClick={() => setSelectedIboClient(client)}
                                  className="w-full p-2 text-left hover:bg-emerald-500/10 transition-colors border-b border-border-color last:border-b-0"
                                >
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {client.server_name}
                                  </p>
                                  <p className="text-xs text-text-muted truncate">
                                    MAC: {client.mac_device}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-emerald-400 truncate">
                                {selectedIboClient.server_name}
                              </p>
                              <p className="text-xs text-text-muted">{selectedIboClient.mac_device}</p>
                            </div>
                            <button
                              onClick={() => setSelectedIboClient(null)}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <X size={14} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-text-muted p-2 bg-bg-tertiary rounded-lg">
                      Selecione uma conta
                    </p>
                  )}
                </div>
              </div>
              
              {/* Info sobre sincronização */}
              {selectedKofficeClient && selectedIboClient && (
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center gap-2">
                  <Link2 size={16} className="text-cyan-500" />
                  <span className="text-xs text-cyan-400">A playlist M3U será copiada do Koffice para o IBO ao sincronizar</span>
                </div>
              )}
              
              {/* Botão Sincronizar */}
              <button
                onClick={handleSync}
                disabled={!canExecute || executing}
                className="w-full h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Sincronizar Playlist
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
