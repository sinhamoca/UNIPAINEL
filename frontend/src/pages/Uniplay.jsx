// ========================================
// UNIPLAY PAGE - Gerenciamento de Contas
// ========================================

import { useState, useEffect } from 'react';
import { 
  Radio, Users, Plus, Trash2, Edit, RefreshCw, Search, 
  Loader2, CheckCircle, XCircle, Eye, UserCheck, Calendar,
  Wifi, WifiOff, ChevronDown, ChevronUp, Clock, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uniplayAPI } from '../../services/api';

export default function UniplayPage() {
  // Estados
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [clients, setClients] = useState({ p2p: [], iptv: [], total: 0 });
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'p2p', 'iptv'
  const [expandedAccount, setExpandedAccount] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({ name: '', username: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [renewCredits, setRenewCredits] = useState(1);
  const [renewLoading, setRenewLoading] = useState(false);

  // Carregar contas
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await uniplayAPI.getAccounts();
      setAccounts(response.data.accounts || []);
    } catch (err) {
      toast.error('Erro ao carregar contas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar conta
  const handleAddAccount = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.username || !formData.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    try {
      setFormLoading(true);
      await uniplayAPI.createAccount(formData);
      toast.success('Conta adicionada com sucesso!');
      setShowAddModal(false);
      setFormData({ name: '', username: '', password: '' });
      loadAccounts();
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setFormLoading(false);
    }
  };

  // Deletar conta
  const handleDeleteAccount = async (account) => {
    if (!confirm(`Remover conta "${account.name}"?`)) return;
    
    try {
      await uniplayAPI.deleteAccount(account.id);
      toast.success('Conta removida!');
      loadAccounts();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    }
  };

  // Testar conexão
  const handleTestConnection = async (account) => {
    try {
      toast.loading('Testando conexão...', { id: 'test-conn' });
      const response = await uniplayAPI.testConnection(account.id);
      
      if (response.data.success) {
        toast.success('Conexão OK!', { id: 'test-conn' });
      } else {
        toast.error('Falha: ' + response.data.message, { id: 'test-conn' });
      }
      loadAccounts();
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message), { id: 'test-conn' });
    }
  };

  // Ver clientes
  const handleViewClients = async (account) => {
    setSelectedAccount(account);
    setShowClientsModal(true);
    setLoadingClients(true);
    setClients({ p2p: [], iptv: [], total: 0 });
    setSearchTerm('');
    setActiveTab('all');
    
    try {
      const response = await uniplayAPI.getClients(account.id);
      setClients(response.data.clients);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingClients(false);
    }
  };

  // Filtrar clientes
  const getFilteredClients = () => {
    let filtered = [];
    
    if (activeTab === 'all' || activeTab === 'p2p') {
      filtered = filtered.concat(clients.p2p || []);
    }
    if (activeTab === 'all' || activeTab === 'iptv') {
      filtered = filtered.concat(clients.iptv || []);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(search) ||
        c.username?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };

  // Abrir modal de renovação
  const handleOpenRenew = (client) => {
    setSelectedClient(client);
    setRenewCredits(1);
    setShowRenewModal(true);
  };

  // Renovar cliente
  const handleRenewClient = async () => {
    if (!selectedClient || !selectedAccount) return;
    
    try {
      setRenewLoading(true);
      await uniplayAPI.renewClient(
        selectedAccount.id, 
        selectedClient.id, 
        { type: selectedClient.type, credits: renewCredits }
      );
      
      toast.success(`"${selectedClient.name}" renovado com ${renewCredits} crédito(s)!`);
      setShowRenewModal(false);
      
      // Recarregar clientes
      handleViewClients(selectedAccount);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setRenewLoading(false);
    }
  };

  // Verificar se expirou
  const isExpired = (expiry) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  // Formatar data
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Radio className="text-orange-500" />
            Uniplay (GesDefender)
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Gerenciamento de clientes P2P e IPTV
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Conta
        </button>
      </div>

      {/* Lista de Contas */}
      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <div className="bg-bg-secondary rounded-xl p-8 text-center border border-border-color">
            <Radio className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
            <p className="text-text-muted">Nenhuma conta cadastrada</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Adicionar Conta
            </button>
          </div>
        ) : (
          accounts.map(account => (
            <div
              key={account.id}
              className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden"
            >
              {/* Header da conta */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    account.hasActiveToken ? 'bg-green-500/20' : 'bg-gray-500/20'
                  }`}>
                    {account.hasActiveToken ? (
                      <Wifi className="text-green-400" size={20} />
                    ) : (
                      <WifiOff className="text-gray-400" size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-text-primary">{account.name}</h3>
                    <p className="text-sm text-text-secondary">{account.username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {account.hasActiveToken && (
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                      Token: {account.tokenExpiresIn}
                    </span>
                  )}
                  
                  <button
                    onClick={() => handleViewClients(account)}
                    className="p-2 text-text-secondary hover:text-orange-400 hover:bg-orange-500/10 rounded-lg"
                    title="Ver Clientes"
                  >
                    <Users size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleTestConnection(account)}
                    className="p-2 text-text-secondary hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                    title="Testar Conexão"
                  >
                    <RefreshCw size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteAccount(account)}
                    className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                    title="Remover"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Info adicional */}
              {account.last_login_at && (
                <div className="px-4 pb-3 text-xs text-text-muted">
                  Último login: {formatDate(account.last_login_at)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal - Adicionar Conta */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-color">
            <h2 className="text-lg font-bold text-text-primary mb-4">Nova Conta Uniplay</h2>
            
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Nome (identificação)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-text-primary"
                  placeholder="Ex: Minha Conta Principal"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">Usuário</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-text-primary"
                  placeholder="Usuário do GesDefender"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">Senha</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-text-primary"
                  placeholder="Senha"
                />
              </div>
              
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-xs text-orange-400">
                  ⚠️ A conexão será testada ao salvar. Requer proxy residencial BR configurado no servidor.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Testando...
                    </>
                  ) : (
                    'Adicionar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Lista de Clientes */}
      {showClientsModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border-color">
            {/* Header */}
            <div className="p-4 border-b border-border-color">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    Clientes - {selectedAccount.name}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {clients.total} clientes ({clients.p2p?.length || 0} P2P, {clients.iptv?.length || 0} IPTV)
                  </p>
                </div>
                <button
                  onClick={() => setShowClientsModal(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <XCircle size={24} />
                </button>
              </div>
              
              {/* Tabs + Search */}
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
                  {['all', 'p2p', 'iptv'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-orange-600 text-white'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tab === 'all' ? 'Todos' : tab.toUpperCase()}
                    </button>
                  ))}
                </div>
                
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome ou usuário..."
                    className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-text-primary"
                  />
                </div>
              </div>
            </div>
            
            {/* Lista de Clientes */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingClients ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="ml-3 text-text-secondary">Carregando clientes...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredClients().length === 0 ? (
                    <div className="text-center py-8 text-text-muted">
                      {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente'}
                    </div>
                  ) : (
                    getFilteredClients().map(client => (
                      <div
                        key={`${client.type}-${client.id}`}
                        className="bg-bg-tertiary rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            client.type === 'p2p'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {client.type.toUpperCase()}
                          </span>
                          
                          <div>
                            <p className="font-medium text-text-primary">{client.name || 'Sem nome'}</p>
                            <p className="text-sm text-text-secondary">{client.username}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-sm ${isExpired(client.expiry) ? 'text-red-400' : 'text-green-400'}`}>
                              {formatDate(client.expiry)}
                            </p>
                            {isExpired(client.expiry) && (
                              <span className="text-xs text-red-400">Expirado</span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleOpenRenew(client)}
                            className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center gap-1"
                          >
                            <Zap size={14} />
                            Renovar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal - Renovar Cliente */}
      {showRenewModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-color">
            <h2 className="text-lg font-bold text-text-primary mb-4">Renovar Cliente</h2>
            
            <div className="space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <p className="text-sm text-text-secondary">Cliente</p>
                <p className="font-medium text-text-primary">{selectedClient.name}</p>
                <p className="text-sm text-text-secondary mt-1">{selectedClient.username}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                  selectedClient.type === 'p2p'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {selectedClient.type.toUpperCase()}
                </span>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-2">Créditos (meses)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 6, 12].map(num => (
                    <button
                      key={num}
                      onClick={() => setRenewCredits(num)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        renewCredits === num
                          ? 'bg-orange-600 text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRenewModal(false)}
                  className="flex-1 px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRenewClient}
                  disabled={renewLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {renewLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Renovando...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Renovar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
