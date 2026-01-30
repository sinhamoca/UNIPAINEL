// pages/koffice/Clients.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { kofficeAPI } from '../../services/api';
import { 
  Search, 
  Loader2, 
  Users, 
  RefreshCw, 
  Calendar,
  Key,
  User,
  Edit,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  FlaskConical,
  Copy,
  Send,
  UserPlus,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

// Função de copiar com fallback para HTTP
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback para contextos não seguros (HTTP)
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    toast.success('Copiado!');
  } catch (err) {
    console.error('Erro ao copiar:', err);
    toast.error('Erro ao copiar');
  }
};

export default function KofficeClients() {
  const navigate = useNavigate();
  const { accountId: urlAccountId } = useParams();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  // Modals
  const [renewClient, setRenewClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [creatingTest, setCreatingTest] = useState(false);
  const [clientDataResult, setClientDataResult] = useState(null);
  const [generatingData, setGeneratingData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  // Carregar contas
  useEffect(() => {
    loadAccounts();
  }, []);

  // Busca em tempo real
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchQuery || searchQuery.length < 2 || !selectedAccount) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await kofficeAPI.searchClients(selectedAccount.id, searchQuery);
        if (response.data.success) {
          setSearchResults(response.data.clients);
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, selectedAccount]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await kofficeAPI.getAccounts();
      if (response.data.success) {
        setAccounts(response.data.accounts);
        
        // Se tiver accountId na URL, selecionar essa conta
        if (urlAccountId) {
          const urlAccount = response.data.accounts.find(a => a.id === parseInt(urlAccountId));
          if (urlAccount) {
            setSelectedAccount(urlAccount);
            setLoading(false);
            return;
          }
        }
        
        // Senão, procurar conta conectada
        const connectedAccount = response.data.accounts.find(a => 
          a.session_valid_until && new Date(a.session_valid_until) > new Date()
        );
        if (connectedAccount) {
          setSelectedAccount(connectedAccount);
        } else if (response.data.accounts.length > 0) {
          setSelectedAccount(response.data.accounts[0]);
        }
      }
    } catch (error) {
      toast.error('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async (page = 1) => {
    if (!selectedAccount) return;
    
    setClientsLoading(true);
    try {
      const response = await kofficeAPI.getClients(selectedAccount.id, { page });
      if (response.data.success) {
        setClients(response.data.clients);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      toast.error('Erro ao carregar clientes. Verifique se a conta está conectada.');
    } finally {
      setClientsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      loadClients();
    }
  }, [selectedAccount]);

  const handleRenew = async (months) => {
    if (!renewClient || !selectedAccount) return;
    
    const toastId = toast.loading('Renovando...');
    try {
      const response = await kofficeAPI.renewClient(selectedAccount.id, renewClient.id, months);
      if (response.data.success) {
        toast.success(`Renovado por ${months} mês(es)!`, { id: toastId });
        setRenewClient(null);
        loadClients();
      } else {
        toast.error(response.data.error || 'Erro ao renovar', { id: toastId });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao renovar', { id: toastId });
    }
  };

  const handleResetUsername = async (client, showDataAfter = false) => {
    const toastId = toast.loading('Gerando novo username...');
    try {
      const response = await kofficeAPI.resetUsername(selectedAccount.id, client.id);
      if (response.data.success) {
        toast.success(`Novo username: ${response.data.newValue}`, { id: toastId });
        loadClients();
        
        // Se solicitado, buscar dados atualizados e mostrar modal
        if (showDataAfter) {
          const dataResponse = await kofficeAPI.getClientData(selectedAccount.id, client.id);
          if (dataResponse.data.success) {
            setSelectedClient(null);
            setClientDataResult(dataResponse.data);
          }
        }
        return true;
      } else {
        toast.error(response.data.error, { id: toastId });
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro', { id: toastId });
      return false;
    }
  };

  const handleResetPassword = async (client, showDataAfter = false) => {
    const toastId = toast.loading('Gerando nova senha...');
    try {
      const response = await kofficeAPI.resetPassword(selectedAccount.id, client.id);
      if (response.data.success) {
        toast.success(`Nova senha: ${response.data.newValue}`, { id: toastId });
        loadClients();
        
        // Se solicitado, buscar dados atualizados e mostrar modal
        if (showDataAfter) {
          const dataResponse = await kofficeAPI.getClientData(selectedAccount.id, client.id);
          if (dataResponse.data.success) {
            setSelectedClient(null);
            setClientDataResult(dataResponse.data);
          }
        }
        return true;
      } else {
        toast.error(response.data.error, { id: toastId });
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro', { id: toastId });
      return false;
    }
  };

  const handleEditNotes = async (client, notes) => {
    const toastId = toast.loading('Salvando...');
    try {
      const response = await kofficeAPI.editNotes(selectedAccount.id, client.id, notes);
      if (response.data.success) {
        toast.success('Nome atualizado!', { id: toastId });
        loadClients();
        
        // Buscar dados atualizados e mostrar modal
        const dataResponse = await kofficeAPI.getClientData(selectedAccount.id, client.id);
        if (dataResponse.data.success) {
          setEditingClient(null);
          setClientDataResult(dataResponse.data);
        }
        return true;
      } else {
        toast.error(response.data.error, { id: toastId });
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro', { id: toastId });
      return false;
    }
  };

  const handleCreateTest = async () => {
    if (!selectedAccount) return;
    
    setCreatingTest(true);
    const toastId = toast.loading('Criando teste...');
    try {
      const response = await kofficeAPI.createTest(selectedAccount.id);
      if (response.data.success) {
        toast.success('Teste criado!', { id: toastId });
        setTestResult(response.data);
      } else {
        toast.error(response.data.error, { id: toastId });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao criar teste', { id: toastId });
    } finally {
      setCreatingTest(false);
    }
  };

  const handleGenerateData = async (client) => {
    if (!selectedAccount) return;
    
    setGeneratingData(client.id);
    const toastId = toast.loading('Obtendo dados...');
    try {
      const response = await kofficeAPI.getClientData(selectedAccount.id, client.id);
      if (response.data.success) {
        toast.success('Dados obtidos!', { id: toastId });
        setClientDataResult(response.data);
        setSelectedClient(null); // Fechar modal de detalhes se estiver aberto
      } else {
        toast.error(response.data.error, { id: toastId });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao obter dados', { id: toastId });
    } finally {
      setGeneratingData(null);
    }
  };

  const selectSearchResult = (client) => {
    setShowSearchResults(false);
    setSearchQuery('');
    // Abrir modal de detalhes do cliente com ações
    setSelectedClient(client);
  };

  const isConnected = selectedAccount?.session_valid_until && 
                      new Date(selectedAccount.session_valid_until) > new Date();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-bg-card border border-border-color rounded-2xl p-12 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma conta configurada</h3>
          <p className="text-text-muted mb-6">
            Configure uma conta do Koffice primeiro
          </p>
          <button
            onClick={() => navigate('/koffice/contas')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast"
          >
            Configurar Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {urlAccountId && (
            <button
              onClick={() => navigate('/koffice')}
              className="p-2 hover:bg-bg-tertiary rounded-lg transition-fast"
            >
              <ArrowLeft size={20} className="text-text-muted" />
            </button>
          )}
          <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
            <Users className="text-cyan-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
            <p className="text-text-muted text-xs sm:text-sm">
              {selectedAccount ? selectedAccount.name : 'Koffice'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de conta (oculto se veio da URL) */}
          {!urlAccountId && (
            <select
              value={selectedAccount?.id || ''}
              onChange={(e) => {
                const acc = accounts.find(a => a.id === parseInt(e.target.value));
                setSelectedAccount(acc);
              }}
              className="h-10 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary focus:border-cyan-500 transition-fast"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleCreateTest}
            disabled={creatingTest || !isConnected}
            className="h-10 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-fast flex items-center gap-2 disabled:opacity-50"
          >
            {creatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical size={16} />}
            <span className="hidden sm:inline">Criar Teste</span>
          </button>

          <button
            onClick={() => loadClients()}
            className="h-10 px-3 bg-bg-tertiary border border-border-color hover:border-border-light rounded-xl text-text-secondary hover:text-text-primary transition-fast flex items-center gap-2"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Links de navegação */}
      {selectedAccount && (
        <div className="flex gap-2 mb-6">
          <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg">
            Clientes
          </button>
          <Link
            to={`/koffice/${selectedAccount.id}/resellers`}
            className="px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-fast flex items-center gap-2"
          >
            <UserPlus size={16} />
            Revendas
          </Link>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
            placeholder="Buscar por ID, username ou nome..."
            className="w-full h-14 bg-bg-card border border-border-color rounded-xl pl-12 pr-12 text-text-primary focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-fast"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500 animate-spin" size={20} />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-color rounded-xl shadow-lg max-h-96 overflow-y-auto z-50 animate-slide-down">
            <div className="p-2">
              <p className="text-xs text-text-muted px-3 py-2">
                {searchResults.length} resultado(s)
              </p>
              {searchResults.map((client, index) => (
                <button
                  key={client.id || index}
                  onClick={() => selectSearchResult(client)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-fast text-left"
                >
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center text-cyan-500 font-semibold">
                    {client.name?.[0] || client.username?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name || client.username}</p>
                    <p className="text-xs text-text-muted font-mono">ID: {client.id} • User: {client.username}</p>
                  </div>
                  <StatusBadge status={client.status} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-color rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border-color flex items-center justify-between">
          <h3 className="font-semibold">Lista de Clientes</h3>
          {pagination && (
            <p className="text-sm text-text-muted">
              Página {pagination.currentPage} de {pagination.lastPage} ({pagination.total} total)
            </p>
          )}
        </div>

        {clientsLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            {isConnected ? 'Nenhum cliente encontrado' : 'Conecte-se à conta para ver os clientes'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary">
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Cliente</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Credenciais</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Validade</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-t border-border-color hover:bg-bg-hover transition-fast">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center text-cyan-500 font-semibold">
                            {client.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{client.name || 'Sem nome'}</p>
                            <p className="text-xs text-text-muted">ID: {client.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-mono">
                            <span className="text-text-muted">User:</span> {client.username}
                          </p>
                          <p className="text-sm font-mono">
                            <span className="text-text-muted">Pass:</span> {client.password}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {client.expiresAt || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={client.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleGenerateData(client)}
                            disabled={generatingData === client.id}
                            className="p-2 text-text-muted hover:text-purple-500 hover:bg-purple-500/10 rounded-lg transition-fast disabled:opacity-50"
                            title="Gerar Dados"
                          >
                            {generatingData === client.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => setRenewClient(client)}
                            className="p-2 text-text-muted hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-fast"
                            title="Renovar"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => handleResetUsername(client, true)}
                            className="p-2 text-text-muted hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-fast"
                            title="Novo Username"
                          >
                            <User size={16} />
                          </button>
                          <button
                            onClick={() => handleResetPassword(client, true)}
                            className="p-2 text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-fast"
                            title="Nova Senha"
                          >
                            <Key size={16} />
                          </button>
                          <button
                            onClick={() => setEditingClient(client)}
                            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-fast"
                            title="Editar Nome"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border-color">
              {clients.map((client) => (
                <div key={client.id} className="p-4 hover:bg-bg-hover transition-fast">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-500 font-bold text-lg flex-shrink-0">
                      {client.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{client.name || 'Sem nome'}</p>
                      <p className="text-xs text-text-muted">ID: {client.id}</p>
                    </div>
                    <StatusBadge status={client.status} />
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3 mb-3 space-y-1">
                    <p className="text-sm font-mono">
                      <span className="text-text-muted">User:</span> {client.username}
                    </p>
                    <p className="text-sm font-mono">
                      <span className="text-text-muted">Pass:</span> {client.password}
                    </p>
                    <p className="text-sm">
                      <span className="text-text-muted">Exp:</span> {client.expiresAt || '—'}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleGenerateData(client)}
                      disabled={generatingData === client.id}
                      className="p-2.5 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-fast disabled:opacity-50"
                      title="Dados"
                    >
                      {generatingData === client.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => setRenewClient(client)}
                      className="p-2.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-fast"
                      title="Renovar"
                    >
                      <Calendar size={18} />
                    </button>
                    <button
                      onClick={() => handleResetUsername(client, true)}
                      className="p-2.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-fast"
                      title="Username"
                    >
                      <User size={18} />
                    </button>
                    <button
                      onClick={() => handleResetPassword(client, true)}
                      className="p-2.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-fast"
                      title="Senha"
                    >
                      <Key size={18} />
                    </button>
                    <button
                      onClick={() => setEditingClient(client)}
                      className="p-2.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-fast"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.lastPage > 1 && (
          <div className="p-4 border-t border-border-color flex items-center justify-center gap-2">
            <button
              onClick={() => loadClients(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-4 text-sm text-text-secondary">
              {pagination.currentPage} / {pagination.lastPage}
            </span>
            <button
              onClick={() => loadClients(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.lastPage}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Modal de Renovação */}
      {renewClient && (
        <RenewModal
          client={renewClient}
          onClose={() => setRenewClient(null)}
          onRenew={handleRenew}
        />
      )}

      {/* Modal de Edição */}
      {editingClient && (
        <EditModal
          client={editingClient}
          accountId={selectedAccount?.id}
          onClose={() => setEditingClient(null)}
          onSaved={(notes) => handleEditNotes(editingClient, notes)}
        />
      )}

      {/* Modal de Teste */}
      {testResult && (
        <TestResultModal
          result={testResult}
          onClose={() => setTestResult(null)}
        />
      )}

      {/* Modal de Dados do Cliente */}
      {clientDataResult && (
        <ClientDataModal
          result={clientDataResult}
          onClose={() => setClientDataResult(null)}
        />
      )}

      {/* Modal de Detalhes do Cliente (da pesquisa) */}
      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          accountId={selectedAccount?.id}
          onClose={() => setSelectedClient(null)}
          onGenerateData={() => {
            handleGenerateData(selectedClient);
          }}
          onRenew={() => {
            setSelectedClient(null);
            setRenewClient(selectedClient);
          }}
          onResetUsername={async () => {
            await handleResetUsername(selectedClient, true);
          }}
          onResetPassword={async () => {
            await handleResetPassword(selectedClient, true);
          }}
          onEdit={() => {
            setSelectedClient(null);
            setEditingClient(selectedClient);
          }}
          generatingData={generatingData === selectedClient?.id}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Ativo') {
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">🟢 Ativo</span>;
  }
  if (status === 'Bloqueado') {
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">🔴 Bloqueado</span>;
  }
  if (status === 'Expirado') {
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400">🟡 Expirado</span>;
  }
  return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-bg-tertiary text-text-muted">{status || 'N/A'}</span>;
}

function ClientDetailsModal({ 
  client, 
  onClose, 
  onGenerateData, 
  onRenew, 
  onResetUsername, 
  onResetPassword, 
  onEdit,
  generatingData 
}) {
  const [actionLoading, setActionLoading] = useState(null);

  const handleAction = async (action, callback) => {
    setActionLoading(action);
    try {
      await callback();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="text-cyan-400" size={20} />
            Detalhes do Cliente
          </h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Informações do Cliente */}
          <div className="p-4 bg-bg-tertiary rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-500 font-bold text-lg">
                {client.name?.[0] || '?'}
              </div>
              <div>
                <p className="font-semibold text-lg">{client.name || 'Sem nome'}</p>
                <p className="text-sm text-text-muted">ID: {client.id}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-color">
              <div>
                <p className="text-xs text-text-muted mb-1">Usuário</p>
                <p className="font-mono text-sm">{client.username}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Senha</p>
                <p className="font-mono text-sm">{client.password}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-color">
              <div>
                <p className="text-xs text-text-muted mb-1">Validade</p>
                <p className="text-sm">{client.expiresAt || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Status</p>
                <StatusBadge status={client.status} />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Ações Rápidas</p>
            
            {/* Gerar Dados - Destaque */}
            <button
              onClick={() => handleAction('data', onGenerateData)}
              disabled={generatingData || actionLoading}
              className="w-full h-12 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generatingData ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  Gerar Dados do Cliente
                </>
              )}
            </button>

            {/* Outras ações em grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAction('renew', onRenew)}
                disabled={actionLoading}
                className="h-11 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-medium rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Calendar size={16} />
                Renovar
              </button>
              
              <button
                onClick={() => handleAction('edit', onEdit)}
                disabled={actionLoading}
                className="h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-medium rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Edit size={16} />
                Editar Nome
              </button>
              
              <button
                onClick={() => handleAction('username', onResetUsername)}
                disabled={actionLoading === 'username'}
                className="h-11 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'username' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <User size={16} />
                    Novo User
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleAction('password', onResetPassword)}
                disabled={actionLoading === 'password'}
                className="h-11 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'password' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Key size={16} />
                    Nova Senha
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Fechar */}
          <button 
            onClick={onClose} 
            className="w-full h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function RenewModal({ client, onClose, onRenew }) {
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleRenew = async () => {
    setLoading(true);
    await onRenew(months);
    setLoading(false);
  };

  const presets = [1, 2, 3, 6, 12];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Renovar Cliente</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-text-secondary mb-4">
            Renovar <strong>{client.name || client.username}</strong>
          </p>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {presets.map(m => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-fast ${
                  months === m
                    ? 'bg-cyan-500 text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {m} {m === 1 ? 'mês' : 'meses'}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button 
              onClick={handleRenew} 
              disabled={loading}
              className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Renovar +${months} mês(es)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ client, accountId, onClose, onSaved }) {
  const [notes, setNotes] = useState(client.name || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Chamar callback do pai com o novo nome
      await onSaved(notes);
    } catch (error) {
      // Erro já tratado no pai
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Editar Cliente</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-bg-tertiary rounded-xl">
            <p className="text-sm text-text-muted mb-1">ID: {client.id}</p>
            <p className="text-sm text-text-muted">User: {client.username} | Pass: {client.password}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Nome / Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-500 transition-fast"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> Salvar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestResultModal({ result, onClose }) {
  // Extrair informações da rawMessage
  const rawMessage = result.rawMessage || '';
  
  // Extrair URL M3U (TS)
  const m3uMatch = rawMessage.match(/TS\s*-\s*(http[^\s\n]+)/i);
  const m3uUrl = m3uMatch ? m3uMatch[1] : null;
  
  // Extrair DNS recomendado
  const dnsMatch = rawMessage.match(/DNS HTTPS Recomendado[^:]*:\s*(http[^\s\n]+)/i);
  const dnsUrl = dnsMatch ? dnsMatch[1] : 'http://ded36.com';
  
  // Extrair códigos dos aplicativos
  const lazerMatch = rawMessage.match(/LazerPlayer[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+(?:\s*ou\s*[0-9]+)?)/i);
  const funplayMatch = rawMessage.match(/FunPlay[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  const playsimMatch = rawMessage.match(/PlaySim[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  const assistMatch = rawMessage.match(/Assist\s*Plus[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  
  const lazerCode = lazerMatch ? lazerMatch[1] : '123 ou 012';
  const funplayCode = funplayMatch ? funplayMatch[1] : '123';
  const playsimCode = playsimMatch ? playsimMatch[1] : '121';
  const assistCode = assistMatch ? assistMatch[1] : '121';

  // Componente de bloco copiável
  const CopyBlock = ({ title, content, textToCopy }) => (
    <div className="p-4 bg-bg-tertiary rounded-xl">
      {title && <p className="text-xs text-text-muted mb-2 font-semibold">{title}</p>}
      <div className="flex items-start justify-between gap-2">
        <pre className="text-sm text-text-primary whitespace-pre-wrap flex-1 font-mono">{content}</pre>
        <button 
          onClick={() => copyToClipboard(textToCopy || content)} 
          className="p-2 hover:bg-bg-hover rounded-lg transition-fast shrink-0"
          title="Copiar"
        >
          <Copy size={16} className="text-text-muted hover:text-cyan-400" />
        </button>
      </div>
    </div>
  );

  // Montar textos para copiar
  const block1 = `Usuario: ${result.user}\nSenha: ${result.password}`;
  const block2 = `Url: ${dnsUrl}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block3 = m3uUrl || `${dnsUrl}/get.php?username=${result.user}&password=${result.password}&type=m3u_plus&output=ts`;
  const block4 = `Aplicativo: LazerPlayer\n\nCODIGO: ${lazerCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block5 = `Aplicativo: FunPlay\n\nCODIGO: ${funplayCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block6 = `Aplicativo: PlaySim\n\nCODIGO: ${playsimCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block7 = `Aplicativo: Assist Plus\n\nCODIGO: ${assistCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-2xl animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border-color shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="text-emerald-400" size={20} />
            Teste Criado com Sucesso!
          </h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Bloco 1 - Credenciais */}
          <CopyBlock 
            title="📱 Credenciais" 
            content={block1}
          />

          {/* Bloco 2 - XC/API */}
          <CopyBlock 
            title="🌐 Conexão XC/API" 
            content={block2}
          />

          {/* Bloco 3 - URL M3U */}
          <CopyBlock 
            title="📺 URL M3U Completa" 
            content={block3}
          />

          {/* Bloco 4 - LazerPlayer */}
          <CopyBlock 
            title="📲 Smart TV - LazerPlayer" 
            content={block4}
          />

          {/* Bloco 5 - FunPlay */}
          <CopyBlock 
            title="📲 Smart TV - FunPlay" 
            content={block5}
          />

          {/* Bloco 6 - PlaySim */}
          <CopyBlock 
            title="📲 Smart TV - PlaySim" 
            content={block6}
          />

          {/* Bloco 7 - Assist Plus */}
          <CopyBlock 
            title="📲 Smart TV - Assist Plus" 
            content={block7}
          />

          {result.validUntil && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <p className="text-sm text-emerald-400">⏱️ Válido até: <strong>{result.validUntil}</strong></p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-color shrink-0">
          <button onClick={onClose} className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientDataModal({ result, onClose }) {
  // Extrair informações da rawMessage
  const rawMessage = result.rawMessage || '';
  
  // Extrair URL M3U (TS)
  const m3uMatch = rawMessage.match(/TS\s*-\s*(http[^\s\n]+)/i);
  const m3uUrl = m3uMatch ? m3uMatch[1] : null;
  
  // Extrair DNS recomendado
  const dnsMatch = rawMessage.match(/DNS HTTPS Recomendado[^:]*:\s*(http[^\s\n]+)/i);
  const dnsUrl = dnsMatch ? dnsMatch[1] : 'http://ded36.com';
  
  // Extrair códigos dos aplicativos
  const lazerMatch = rawMessage.match(/LazerPlayer[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+(?:\s*ou\s*[0-9]+)?)/i);
  const funplayMatch = rawMessage.match(/FunPlay[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  const playsimMatch = rawMessage.match(/PlaySim[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  const assistMatch = rawMessage.match(/Assist\s*Plus[\s\S]*?CODIGO\s*:?➡?\s*([0-9]+)/i);
  
  const lazerCode = lazerMatch ? lazerMatch[1] : '123 ou 012';
  const funplayCode = funplayMatch ? funplayMatch[1] : '123';
  const playsimCode = playsimMatch ? playsimMatch[1] : '121';
  const assistCode = assistMatch ? assistMatch[1] : '121';

  // Componente de bloco copiável
  const CopyBlock = ({ title, content, textToCopy }) => (
    <div className="p-4 bg-bg-tertiary rounded-xl">
      {title && <p className="text-xs text-text-muted mb-2 font-semibold">{title}</p>}
      <div className="flex items-start justify-between gap-2">
        <pre className="text-sm text-text-primary whitespace-pre-wrap flex-1 font-mono">{content}</pre>
        <button 
          onClick={() => copyToClipboard(textToCopy || content)} 
          className="p-2 hover:bg-bg-hover rounded-lg transition-fast shrink-0"
          title="Copiar"
        >
          <Copy size={16} className="text-text-muted hover:text-cyan-400" />
        </button>
      </div>
    </div>
  );

  // Montar textos para copiar
  const block1 = `Usuario: ${result.user}\nSenha: ${result.password}`;
  const block2 = `Url: ${dnsUrl}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block3 = m3uUrl || `${dnsUrl}/get.php?username=${result.user}&password=${result.password}&type=m3u_plus&output=ts`;
  const block4 = `Aplicativo: LazerPlayer\n\nCODIGO: ${lazerCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block5 = `Aplicativo: FunPlay\n\nCODIGO: ${funplayCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block6 = `Aplicativo: PlaySim\n\nCODIGO: ${playsimCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;
  const block7 = `Aplicativo: Assist Plus\n\nCODIGO: ${assistCode}\nUsuario: ${result.user}\nSenha: ${result.password}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-2xl animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border-color shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Send className="text-purple-400" size={20} />
            Dados do Cliente
          </h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Bloco 1 - Credenciais */}
          <CopyBlock 
            title="📱 Credenciais" 
            content={block1}
          />

          {/* Bloco 2 - XC/API */}
          <CopyBlock 
            title="🌐 Conexão XC/API" 
            content={block2}
          />

          {/* Bloco 3 - URL M3U */}
          <CopyBlock 
            title="📺 URL M3U Completa" 
            content={block3}
          />

          {/* Bloco 4 - LazerPlayer */}
          <CopyBlock 
            title="📲 Smart TV - LazerPlayer" 
            content={block4}
          />

          {/* Bloco 5 - FunPlay */}
          <CopyBlock 
            title="📲 Smart TV - FunPlay" 
            content={block5}
          />

          {/* Bloco 6 - PlaySim */}
          <CopyBlock 
            title="📲 Smart TV - PlaySim" 
            content={block6}
          />

          {/* Bloco 7 - Assist Plus */}
          <CopyBlock 
            title="📲 Smart TV - Assist Plus" 
            content={block7}
          />

          {result.validUntil && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
              <p className="text-sm text-purple-400">⏱️ Válido até: <strong>{result.validUntil}</strong></p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-color shrink-0">
          <button onClick={onClose} className="w-full h-11 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-fast">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
