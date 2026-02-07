// components/widgets/SyncSigmaIboWidget.jsx
// Widget de Sincronização Sigma → IBO Revenda

import { useState, useEffect } from 'react';
import { 
  RefreshCw, Search, Tv, Users, ArrowRight, Check, 
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

export default function SyncSigmaIboWidget() {
  // Estado de expansão do widget
  const [expanded, setExpanded] = useState(false);
  
  // Contas disponíveis
  const [sigmaAccounts, setSigmaAccounts] = useState([]);
  const [iboAccounts, setIboAccounts] = useState([]);
  
  // Contas selecionadas
  const [selectedSigma, setSelectedSigma] = useState('');
  const [selectedIbo, setSelectedIbo] = useState('');
  
  // Pesquisa e resultados - Sigma
  const [sigmaSearch, setSigmaSearch] = useState('');
  const [sigmaResults, setSigmaResults] = useState([]);
  const [sigmaLoading, setSigmaLoading] = useState(false);
  const [selectedSigmaClient, setSelectedSigmaClient] = useState(null);
  
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
  const debouncedSigmaSearch = useDebounce(sigmaSearch, 500);
  const debouncedIboSearch = useDebounce(iboSearch, 500);
  const debouncedGlobalSearch = useDebounce(globalSearch, 500);
  
  // Carregar contas ao montar
  useEffect(() => {
    loadAccounts();
  }, []);
  
  const loadAccounts = async () => {
    try {
      const [sigmaRes, iboRes] = await Promise.all([
        api.get('/sigma/accounts'),
        api.get('/gerencia/accounts')
      ]);
      setSigmaAccounts(sigmaRes.data.accounts || []);
      setIboAccounts(iboRes.data.accounts || []);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  };
  
  // Buscar clientes Sigma
  useEffect(() => {
    if (debouncedSigmaSearch && debouncedSigmaSearch.length >= 2 && selectedSigma) {
      searchSigma(debouncedSigmaSearch);
    } else {
      setSigmaResults([]);
    }
  }, [debouncedSigmaSearch, selectedSigma]);
  
  const searchSigma = async (term) => {
    setSigmaLoading(true);
    try {
      const res = await api.get(`/sigma/accounts/${selectedSigma}/customers?search=${encodeURIComponent(term)}&perPage=10`);
      setSigmaResults(res.data.customers || []);
    } catch (err) {
      console.error('Erro ao buscar Sigma:', err);
      setSigmaResults([]);
    } finally {
      setSigmaLoading(false);
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
    if (debouncedGlobalSearch && debouncedGlobalSearch.length >= 2 && selectedSigma && selectedIbo) {
      searchGlobal(debouncedGlobalSearch);
    }
  }, [debouncedGlobalSearch, selectedSigma, selectedIbo]);
  
  const searchGlobal = async (term) => {
    setGlobalLoading(true);
    try {
      const [sigmaRes, iboRes] = await Promise.all([
        api.get(`/sigma/accounts/${selectedSigma}/customers?search=${encodeURIComponent(term)}&perPage=10`),
        api.get(`/gerencia/accounts/${selectedIbo}/users?search=${encodeURIComponent(term)}`)
      ]);
      
      setSigmaResults(sigmaRes.data.customers || []);
      setIboResults(iboRes.data.users || []);
      
      // Auto-selecionar se encontrou exatamente 1 em cada
      const sClients = sigmaRes.data.customers || [];
      const iClients = iboRes.data.users || [];
      
      if (sClients.length === 1) {
        setSelectedSigmaClient(sClients[0]);
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
  
  // Buscar playlist do cliente Sigma via detalhes do cliente
  const fetchSigmaPlaylist = async (accountId, customerId) => {
    try {
      // Buscar detalhes do cliente (onde vem o m3u_url)
      const res = await api.get(`/sigma/accounts/${accountId}/customers/${customerId}`);
      if (res.data.success && res.data.customer) {
        // Campo correto é m3u_url
        return res.data.customer.m3u_url || res.data.customer.m3u_url_short || null;
      }
      // Fallback: dados direto na resposta
      if (res.data.m3u_url) {
        return res.data.m3u_url;
      }
      return null;
    } catch (err) {
      console.error('Erro ao buscar playlist:', err);
      return null;
    }
  };
  
  // Executar sincronização
  const handleSync = async () => {
    if (!selectedSigmaClient || !selectedIboClient) {
      toast.error('Selecione os clientes em ambos os sistemas');
      return;
    }
    
    setExecuting(true);
    
    try {
      // Buscar playlist do cliente Sigma
      const m3uUrl = await fetchSigmaPlaylist(selectedSigma, selectedSigmaClient.id);
      
      if (!m3uUrl) {
        toast.error('Não foi possível obter playlist do cliente Sigma. Verifique se está ativo.');
        return;
      }
      
      // Atualizar apenas a playlist do cliente IBO
      const res = await api.put(`/gerencia/accounts/${selectedIbo}/users/${selectedIboClient.id}`, {
        m3u8_list: m3uUrl
      });
      
      if (res.data.success) {
        setResult({
          success: true,
          sigmaClient: selectedSigmaClient.note || selectedSigmaClient.username,
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
    setSelectedSigmaClient(null);
    setSelectedIboClient(null);
    setSigmaSearch('');
    setIboSearch('');
    setGlobalSearch('');
    setSigmaResults([]);
    setIboResults([]);
    setResult(null);
  };
  
  // Verificar se pode executar
  const canExecute = selectedSigma && selectedIbo && selectedSigmaClient && selectedIboClient;

  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-violet-500/30 rounded-2xl overflow-hidden">
      {/* Header - Sempre visível */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
              <Tv size={18} className="text-violet-500" />
            </div>
            <ArrowRight size={14} className="text-text-muted" />
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-emerald-500" />
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-text-primary">Sincronizar Sigma → IBO</h3>
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
                Playlist de <strong>{result.sigmaClient}</strong> copiada para <strong>{result.iboClient}</strong>
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
                  <label className="block text-xs font-medium text-text-muted mb-1">Conta Sigma</label>
                  <select
                    value={selectedSigma}
                    onChange={(e) => {
                      setSelectedSigma(e.target.value);
                      setSelectedSigmaClient(null);
                      setSigmaResults([]);
                    }}
                    className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary focus:border-violet-500 transition-fast"
                  >
                    <option value="">Selecione...</option>
                    {sigmaAccounts.map(acc => (
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
              {selectedSigma && selectedIbo && (
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
                {/* Sigma */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tv size={14} className="text-violet-500" />
                    <span className="text-xs font-medium text-text-muted">Cliente Sigma</span>
                  </div>
                  
                  {selectedSigma ? (
                    <>
                      {!selectedSigmaClient ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              value={sigmaSearch}
                              onChange={(e) => setSigmaSearch(e.target.value)}
                              placeholder="Buscar cliente..."
                              className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 pr-8 text-sm text-text-primary focus:border-violet-500 transition-fast"
                            />
                            {sigmaLoading && (
                              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-500" />
                            )}
                          </div>
                          
                          {/* Resultados Sigma */}
                          {sigmaResults.length > 0 && (
                            <div className="bg-bg-tertiary border border-border-color rounded-lg max-h-40 overflow-y-auto">
                              {sigmaResults.map(client => (
                                <button
                                  key={client.id}
                                  onClick={() => setSelectedSigmaClient(client)}
                                  className="w-full p-2 text-left hover:bg-violet-500/10 transition-colors border-b border-border-color last:border-b-0"
                                >
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {client.note || client.username}
                                  </p>
                                  <p className="text-xs text-text-muted truncate">
                                    {client.username} • {client.status || 'N/A'} • Exp: {client.expires_at || 'N/A'}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-violet-400 truncate">
                                {selectedSigmaClient.note || selectedSigmaClient.username}
                              </p>
                              <p className="text-xs text-text-muted">{selectedSigmaClient.username} • {selectedSigmaClient.status}</p>
                            </div>
                            <button
                              onClick={() => setSelectedSigmaClient(null)}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <X size={14} className="text-red-400" />
                            </button>
                          </div>
                          {/* M3U será buscado ao sincronizar */}
                          <div className="mt-1 text-xs text-text-muted">
                            Playlist será carregada ao sincronizar
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
              {selectedSigmaClient && selectedIboClient && (
                <div className="p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg flex items-center gap-2">
                  <Link2 size={16} className="text-violet-500" />
                  <span className="text-xs text-violet-400">A playlist M3U será copiada do Sigma para o IBO ao sincronizar</span>
                </div>
              )}
              
              {/* Botão Sincronizar */}
              <button
                onClick={handleSync}
                disabled={!canExecute || executing}
                className="w-full h-11 bg-gradient-to-r from-violet-500 to-emerald-500 hover:from-violet-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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