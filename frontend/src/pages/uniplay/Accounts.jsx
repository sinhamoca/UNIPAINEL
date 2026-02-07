// ========================================
// UNIPLAY PAGE - Gerenciamento de Contas
// ========================================

import { useState, useEffect } from 'react';
import { 
  Radio, Users, Plus, Trash2, Edit, RefreshCw, Search, 
  Loader2, CheckCircle, XCircle, Eye, UserCheck, Calendar,
  Wifi, WifiOff, ChevronDown, ChevronUp, Clock, Zap, FlaskConical, Copy, Check
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
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showTrialResult, setShowTrialResult] = useState(null);
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
  const [trialHours, setTrialHours] = useState(3);
  const [trialLoading, setTrialLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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

  // Abrir modal de criar teste
  const handleOpenTrial = (account) => {
    setSelectedAccount(account);
    setTrialHours(3);
    setShowTrialModal(true);
    setShowTrialResult(null);
  };

  // Criar teste
  const handleCreateTrial = async () => {
    if (!selectedAccount) return;
    
    try {
      setTrialLoading(true);
      const response = await uniplayAPI.createTrial(selectedAccount.id, { hours: trialHours });
      
      if (response.data.success) {
        setShowTrialResult(response.data.trial);
        toast.success('Teste criado com sucesso!');
      } else {
        toast.error('Erro: ' + response.data.error);
      }
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setTrialLoading(false);
    }
  };

  // Copiar texto (com fallback para HTTP)
  const copyToClipboard = (text, field) => {
    // Tentar usar clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedField(field);
        toast.success('Copiado!');
        setTimeout(() => setCopiedField(null), 2000);
      }).catch(() => {
        fallbackCopy(text, field);
      });
    } else {
      fallbackCopy(text, field);
    }
  };

  // Fallback para copiar em HTTP
  const fallbackCopy = (text, field) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      setCopiedField(field);
      toast.success('Copiado!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
    
    document.body.removeChild(textArea);
  };

  // Formatar mensagem do teste para compartilhar
  const formatTrialMessage = (trial) => {
    return `🧪 *TESTE CRIADO*

👤 Usuário: ${trial.username}
🔑 Senha: ${trial.password}
⏰ Válido até: ${trial.expiryFormatted}

📺 *Link M3U:*
${trial.m3u8}

🔗 *Link Curto:*
${trial.m3u8Short}

📡 *DNS:* http://hetsdb.zip

📡 *DNS Smarters (Smarters/XCIPTV/API e outros):* http://hetsdb.zip`;
  };

  // Converter HTML para texto
  const htmlToText = (html) => {
    if (!html) return '';
    
    return html
      // Substituir <br> e <p> por quebras de linha
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      // Extrair texto de links mantendo a URL
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2')
      // Remover tags span e outras mantendo conteúdo
      .replace(/<[^>]+>/g, '')
      // Decodificar entidades HTML
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Limpar espaços extras
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  };

  // Formatar resposta completa para copiar
  const formatFullResponse = (raw) => {
    if (!raw) return '';
    
    let text = `Seja bem vindo ao IPTV!

USUÁRIO: ${raw.username || ''}
SENHA: ${raw.password || ''}
VENCIMENTO: ${raw.exp_date_formatted || raw.exp_date || ''}`;

    if (raw.M3U8) {
      text += `

LINK (M3U8): ${raw.M3U8}`;
    }

    if (raw.short_M3U8) {
      text += `
LINK (M3U8) ENCURTADO: ${raw.short_M3U8}`;
    }

    if (raw.M3U8_2) {
      text += `

LINK (M3U8) HLS: ${raw.M3U8_2}`;
    }

    if (raw.short_M3U8_2) {
      text += `
LINK (M3U8) HLS ENCURTADO: ${raw.short_M3U8_2}`;
    }

    if (raw.short_SSIPTV_M3U8) {
      text += `

LINK SSIPTV (M3U8) ENCURTADO: ${raw.short_SSIPTV_M3U8}`;
    }

    // Adicionar links_franchise convertido de HTML para texto
    if (raw.links_franchise) {
      text += `

${htmlToText(raw.links_franchise)}`;
    }

    // Adicionar mensagem final
    if (raw.test_hours) {
      text += `

APROVEITE!
SEU TESTE É VALIDO POR ${raw.test_hours} HORAS`;
    }

    return text;
  };

  // Verificar se expirou
  const isExpired = (expiry) => {
    if (!expiry) return null; // null = desconhecido
    try {
      const date = parseExpiryDate(expiry);
      if (!date) return null;
      return date < new Date();
    } catch {
      return null;
    }
  };

  // Parsear data de vencimento (suporta vários formatos)
  const parseExpiryDate = (expiry) => {
    if (!expiry) return null;
    
    // Se já for um objeto Date
    if (expiry instanceof Date) return expiry;
    
    // Tentar parsear como string
    const str = String(expiry).trim();
    
    // Formato timestamp Unix (segundos)
    if (/^\d{10}$/.test(str)) {
      return new Date(parseInt(str) * 1000);
    }
    
    // Formato timestamp Unix (milissegundos)
    if (/^\d{13}$/.test(str)) {
      return new Date(parseInt(str));
    }
    
    // Formato ISO ou outros formatos padrão
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // Formato DD/MM/YYYY ou DD-MM-YYYY
    const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (brMatch) {
      return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
    }
    
    return null;
  };

  // Formatar data
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      const parsed = parseExpiryDate(date);
      if (!parsed) return 'N/A';
      
      return parsed.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  // Calcular dias restantes
  const getDaysRemaining = (expiry) => {
    if (!expiry) return null;
    try {
      const date = parseExpiryDate(expiry);
      if (!date) return null;
      
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days;
    } catch {
      return null;
    }
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
                    onClick={() => handleOpenTrial(account)}
                    className="p-2 text-text-secondary hover:text-green-400 hover:bg-green-500/10 rounded-lg"
                    title="Criar Teste"
                  >
                    <FlaskConical size={18} />
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

      {/* Modal - Criar Teste */}
      {showTrialModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-lg border border-border-color max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <FlaskConical className="text-green-500" size={20} />
              Criar Teste - {selectedAccount.name}
            </h2>
            
            {!showTrialResult ? (
              // Formulário para criar teste
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Duração do teste (horas)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 6].map(num => (
                      <button
                        key={num}
                        onClick={() => setTrialHours(num)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          trialHours === num
                            ? 'bg-green-600 text-white'
                            : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {num}h
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTrialModal(false)}
                    className="flex-1 px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateTrial}
                    disabled={trialLoading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {trialLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Criando...
                      </>
                    ) : (
                      <>
                        <FlaskConical size={16} />
                        Criar Teste
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // Resultado do teste criado
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 font-medium flex items-center gap-2">
                    <CheckCircle size={18} />
                    Teste criado com sucesso!
                  </p>
                </div>
                
                {/* Credenciais */}
                <div className="space-y-3">
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Usuário</span>
                      <button
                        onClick={() => copyToClipboard(showTrialResult.username, 'username')}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {copiedField === 'username' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="font-mono text-text-primary">{showTrialResult.username}</p>
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Senha</span>
                      <button
                        onClick={() => copyToClipboard(showTrialResult.password, 'password')}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {copiedField === 'password' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="font-mono text-text-primary">{showTrialResult.password}</p>
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Válido até</span>
                    </div>
                    <p className="text-text-primary">{showTrialResult.expiryFormatted}</p>
                  </div>
                </div>
                
                {/* Links */}
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary font-medium">Links</p>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-text-secondary">M3U8</span>
                      <button
                        onClick={() => copyToClipboard(showTrialResult.m3u8, 'm3u8')}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {copiedField === 'm3u8' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-text-primary break-all">{showTrialResult.m3u8}</p>
                  </div>
                  
                  {showTrialResult.m3u8Short && (
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-text-secondary">Link Curto</span>
                        <button
                          onClick={() => copyToClipboard(showTrialResult.m3u8Short, 'm3u8Short')}
                          className="text-text-muted hover:text-text-primary"
                        >
                          {copiedField === 'm3u8Short' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                      <p className="font-mono text-sm text-text-primary">{showTrialResult.m3u8Short}</p>
                    </div>
                  )}
                  
                  {/* DNS Fixos */}
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-text-secondary">DNS</span>
                      <button
                        onClick={() => copyToClipboard('http://hetsdb.zip', 'dns1')}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {copiedField === 'dns1' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="font-mono text-sm text-text-primary">http://hetsdb.zip</p>
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-text-secondary">DNS Smarters (Smarters/XCIPTV/API e outros)</span>
                      <button
                        onClick={() => copyToClipboard('http://hetsdb.zip', 'dns2')}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {copiedField === 'dns2' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="font-mono text-sm text-text-primary">http://hetsdb.zip</p>
                  </div>
                </div>
                
                {/* Botões */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => copyToClipboard(formatFullResponse(showTrialResult.raw), 'all')}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {copiedField === 'all' ? <Check size={16} /> : <Copy size={16} />}
                    Copiar Tudo
                  </button>
                  <button
                    onClick={() => {
                      setShowTrialResult(null);
                      setShowTrialModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover"
                  >
                    Fechar
                  </button>
                </div>
                
                {/* Criar outro */}
                <button
                  onClick={() => setShowTrialResult(null)}
                  className="w-full px-4 py-2 text-green-400 hover:bg-green-500/10 rounded-lg flex items-center justify-center gap-2"
                >
                  <FlaskConical size={16} />
                  Criar Outro Teste
                </button>
                
                {/* Resposta Completa - Formatada como no Dashboard */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-text-secondary hover:text-text-primary flex items-center gap-2">
                    <ChevronDown size={16} />
                    Ver informações completas
                  </summary>
                  <div className="mt-3 bg-bg-tertiary rounded-lg p-4 relative">
                    <button
                      onClick={() => copyToClipboard(formatFullResponse(showTrialResult.raw), 'fullResponse')}
                      className="absolute top-3 right-3 text-text-muted hover:text-text-primary p-2 bg-bg-secondary rounded-lg flex items-center gap-1 text-xs"
                    >
                      {copiedField === 'fullResponse' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      Copiar
                    </button>
                    
                    <div className="space-y-3 pr-16 text-sm">
                      <p className="text-text-primary font-medium">Seja bem vindo ao IPTV!</p>
                      
                      <div className="space-y-1">
                        <p><span className="font-bold text-text-primary">USUÁRIO:</span> <span className="text-text-secondary">{showTrialResult.raw?.username}</span></p>
                        <p><span className="font-bold text-text-primary">SENHA:</span> <span className="text-text-secondary">{showTrialResult.raw?.password}</span></p>
                        <p><span className="font-bold text-text-primary">VENCIMENTO:</span> <span className="text-text-secondary">{showTrialResult.raw?.exp_date_formatted}</span></p>
                      </div>
                      
                      {showTrialResult.raw?.M3U8 && (
                        <div>
                          <p><span className="font-bold text-text-primary">LINK (M3U8):</span> <span className="text-blue-400 text-xs break-all">{showTrialResult.raw?.M3U8}</span></p>
                        </div>
                      )}
                      
                      {showTrialResult.raw?.short_M3U8 && (
                        <p><span className="font-bold text-text-primary">LINK (M3U8) ENCURTADO:</span> <span className="text-blue-400">{showTrialResult.raw?.short_M3U8}</span></p>
                      )}
                      
                      {showTrialResult.raw?.M3U8_2 && (
                        <div>
                          <p><span className="font-bold text-text-primary">LINK (M3U8) HLS:</span> <span className="text-blue-400 text-xs break-all">{showTrialResult.raw?.M3U8_2}</span></p>
                        </div>
                      )}
                      
                      {showTrialResult.raw?.short_M3U8_2 && (
                        <p><span className="font-bold text-text-primary">LINK (M3U8) HLS ENCURTADO:</span> <span className="text-blue-400">{showTrialResult.raw?.short_M3U8_2}</span></p>
                      )}
                      
                      {showTrialResult.raw?.short_SSIPTV_M3U8 && (
                        <p><span className="font-bold text-text-primary">LINK SSIPTV (M3U8) ENCURTADO:</span> <span className="text-blue-400">{showTrialResult.raw?.short_SSIPTV_M3U8}</span></p>
                      )}
                      
                      {/* Links Franchise - Informações extras */}
                      {showTrialResult.raw?.links_franchise && (
                        <div className="pt-3 border-t border-border-color">
                          <div 
                            className="text-text-secondary whitespace-pre-line text-xs leading-relaxed"
                            dangerouslySetInnerHTML={{ 
                              __html: showTrialResult.raw.links_franchise
                                .replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '<a href="$1" target="_blank" class="text-blue-400 hover:underline">$2</a>')
                            }} 
                          />
                        </div>
                      )}
                      
                      {/* Mensagem final */}
                      {showTrialResult.raw?.test_hours && (
                        <div className="pt-3 border-t border-border-color">
                          <p className="font-bold text-green-400">APROVEITE!</p>
                          <p className="text-text-primary">SEU TESTE É VÁLIDO POR {showTrialResult.raw.test_hours} HORAS</p>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}