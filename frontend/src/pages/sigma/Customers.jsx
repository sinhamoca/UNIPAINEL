// pages/sigma/Customers.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sigmaAPI } from '../../services/api';
import { 
  Users, 
  Loader2, 
  Search, 
  ArrowLeft,
  RefreshCw,
  Calendar,
  Package,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  UserCheck,
  Eye,
  Copy,
  CheckCheck,
  FlaskConical,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SigmaCustomers() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  
  // Estados principais
  const [account, setAccount] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
    totalPages: 1
  });
  
  // Estados do modal de renovação
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [renewing, setRenewing] = useState(false);
  
  // Estados do modal de visualização
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerPlaylist, setCustomerPlaylist] = useState(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estados do modal de TRIAL (Gerar Teste)
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialPackages, setTrialPackages] = useState([]);
  const [loadingTrialPackages, setLoadingTrialPackages] = useState(false);
  const [selectedTrialPackage, setSelectedTrialPackage] = useState(null);
  const [creatingTrial, setCreatingTrial] = useState(false);
  const [trialResult, setTrialResult] = useState(null);

  // Carregar clientes
  const loadCustomers = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      const response = await sigmaAPI.getCustomers(accountId, {
        page,
        perPage: pagination.perPage,
        search
      });
      
      if (response.data.success) {
        setAccount(response.data.account);
        setCustomers(response.data.customers);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao carregar clientes');
      if (error.response?.status === 404) {
        navigate('/sigma');
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, pagination.perPage, navigate]);

  useEffect(() => {
    loadCustomers(1, '');
  }, [accountId]);

  // Buscar com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        setSearching(true);
        loadCustomers(1, searchQuery).finally(() => setSearching(false));
      } else if (searchQuery === '' && !loading) {
        loadCustomers(1, '');
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Formatar data
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Badge de status
  const getStatusBadge = (status) => {
    const statusConfig = {
      ACTIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Ativo' },
      EXPIRED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expirado' },
      BANNED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Banido' },
      DISABLED: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Desativado' }
    };
    
    const config = statusConfig[status] || statusConfig.DISABLED;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Abrir modal de renovação
  const openRenewModal = async (customer) => {
    setSelectedCustomer(customer);
    setSelectedPackage(null);
    setShowRenewModal(true);
    
    // Carregar pacotes
    setLoadingPackages(true);
    try {
      const response = await sigmaAPI.getPackages(accountId);
      if (response.data.success) {
        setPackages(response.data.packages || []);
      }
    } catch (error) {
      toast.error('Erro ao carregar pacotes');
    } finally {
      setLoadingPackages(false);
    }
  };

  // Renovar cliente
  const handleRenew = async () => {
    if (!selectedPackage) {
      toast.error('Selecione um pacote');
      return;
    }
    
    setRenewing(true);
    try {
      const response = await sigmaAPI.renewCustomer(
        accountId,
        selectedCustomer.id,
        selectedPackage.id
      );
      
      if (response.data.success) {
        toast.success('Cliente renovado com sucesso!');
        setShowRenewModal(false);
        loadCustomers(pagination.page, searchQuery);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao renovar cliente');
    } finally {
      setRenewing(false);
    }
  };

  // Abrir modal de visualização
  const openViewModal = async (customer) => {
    setViewingCustomer(customer);
    setCustomerPlaylist(null);
    setShowViewModal(true);
    setCopied(false);
    
    // Carregar dados da playlist
    setLoadingPlaylist(true);
    try {
      const response = await sigmaAPI.getCustomerPlaylist(accountId, customer.id);
      if (response.data.success) {
        setCustomerPlaylist(response.data.playlist);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoadingPlaylist(false);
    }
  };

  // Copiar texto para clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  // Obter template do idioma preferido (pt > en > es)
  const getPreferredTemplate = (playlist) => {
    if (!playlist || !Array.isArray(playlist)) return null;
    
    const ptTemplate = playlist.find(t => t.key === 'pt');
    if (ptTemplate?.template) return ptTemplate.template;
    
    const enTemplate = playlist.find(t => t.key === 'en');
    if (enTemplate?.template) return enTemplate.template;
    
    const esTemplate = playlist.find(t => t.key === 'es');
    if (esTemplate?.template) return esTemplate.template;
    
    return playlist[0]?.template || null;
  };

  // =============================================
  // FUNÇÕES DO MODAL DE TRIAL (GERAR TESTE)
  // =============================================

  // Abrir modal de gerar teste
  const openTrialModal = async () => {
    setShowTrialModal(true);
    setSelectedTrialPackage(null);
    setTrialResult(null);
    setCopied(false);
    
    // Carregar pacotes de teste
    setLoadingTrialPackages(true);
    try {
      const response = await sigmaAPI.getTrialPackages(accountId);
      if (response.data.success) {
        setTrialPackages(response.data.packages || []);
        
        if (response.data.packages?.length === 0) {
          toast.error('Nenhum pacote de teste disponível');
        }
      }
    } catch (error) {
      toast.error('Erro ao carregar pacotes de teste');
    } finally {
      setLoadingTrialPackages(false);
    }
  };

  // Criar teste
  const handleCreateTrial = async () => {
    if (!selectedTrialPackage) {
      toast.error('Selecione um pacote de teste');
      return;
    }
    
    setCreatingTrial(true);
    try {
      const response = await sigmaAPI.createTrialCustomer(accountId, {
        server_id: selectedTrialPackage.server_id,
        package_id: selectedTrialPackage.id,
        trial_hours: selectedTrialPackage.trial_hours || selectedTrialPackage.duration || 2,
        connections: 1
      });
      
      if (response.data.success) {
        toast.success('Teste criado com sucesso!');
        setTrialResult({
          customer: response.data.customer,
          playlist: response.data.playlist
        });
        // Recarregar lista de clientes
        loadCustomers(1, '');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao criar teste');
    } finally {
      setCreatingTrial(false);
    }
  };

  // Fechar modal de trial
  const closeTrialModal = () => {
    setShowTrialModal(false);
    setTrialResult(null);
    setSelectedTrialPackage(null);
    setCopied(false);
  };

  // Paginação
  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      loadCustomers(page, searchQuery);
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/sigma')}
            className="p-2 hover:bg-bg-secondary rounded-lg transition-fast"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Users className="text-violet-500" size={24} />
              Clientes
            </h1>
            {account && (
              <p className="text-sm text-text-muted">{account.name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {/* Botão Gerar Teste */}
          <button
            onClick={openTrialModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-fast flex items-center gap-2 text-sm font-medium"
          >
            <FlaskConical size={16} />
            Gerar Teste
          </button>
          <button
            onClick={() => loadCustomers(pagination.page, searchQuery)}
            className="px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border-color rounded-lg transition-fast flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="bg-bg-secondary rounded-xl p-3 border border-border-color">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-fast text-sm"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-violet-500" />
          )}
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        {customers.length === 0 ? (
          <div className="px-6 py-12 text-center text-text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-bg-tertiary border-b border-border-color">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Pacote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Vendedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Expira</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Conexões</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-text-primary">{customer.username}</span>
                          {customer.note && (
                            <p className="text-xs text-text-muted truncate max-w-[200px]">{customer.note}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {customer.package || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                          <UserCheck size={12} />
                          {customer.reseller || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(customer.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary text-center">
                        {customer.connections || 1}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(customer.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openViewModal(customer)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-fast"
                            title="Visualizar dados"
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            onClick={() => openRenewModal(customer)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-fast"
                          >
                            <Calendar size={14} />
                            Renovar
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
              {customers.map((customer) => (
                <div key={customer.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center text-violet-400 font-semibold">
                      {customer.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{customer.username}</p>
                      <p className="text-xs text-text-muted">
                        <UserCheck size={10} className="inline mr-1" />
                        {customer.reseller || '—'}
                      </p>
                    </div>
                    {getStatusBadge(customer.status)}
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Pacote:</span>
                      <span className="text-sm">{customer.package || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Vendedor:</span>
                      <span className="text-sm">{customer.reseller || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Expira:</span>
                      <span className="text-sm">{formatDate(customer.expires_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Conexões:</span>
                      <span className="text-sm">{customer.connections || 1}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => openViewModal(customer)}
                      className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-fast flex items-center justify-center gap-2"
                    >
                      <Eye size={16} />
                      Ver
                    </button>
                    <button
                      onClick={() => openRenewModal(customer)}
                      className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-fast flex items-center justify-center gap-2"
                    >
                      <Calendar size={16} />
                      Renovar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border-color flex items-center justify-between bg-bg-tertiary">
            <span className="text-sm text-text-muted">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =============================================
          MODAL DE GERAR TESTE (TRIAL)
          ============================================= */}
      {showTrialModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && !trialResult && closeTrialModal()}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-color flex justify-between items-center shrink-0">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <FlaskConical size={20} className="text-amber-500" />
                {trialResult ? 'Teste Criado!' : 'Gerar Teste Rápido'}
              </h2>
              <button onClick={closeTrialModal} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* Etapa 1: Selecionar pacote de teste */}
              {!trialResult && (
                <>
                  {loadingTrialPackages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                      <span className="ml-3 text-text-muted">Carregando pacotes de teste...</span>
                    </div>
                  ) : trialPackages.length === 0 ? (
                    <div className="text-center py-12 text-text-muted">
                      <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum pacote de teste disponível</p>
                      <p className="text-sm mt-2">Verifique se há pacotes marcados como "Trial" no painel Sigma.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-text-secondary">
                        Selecione o pacote de teste:
                      </label>
                      
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {trialPackages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedTrialPackage(pkg)}
                            className={`w-full p-4 rounded-lg border text-left transition-fast ${
                              selectedTrialPackage?.id === pkg.id
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-border-color hover:border-amber-500/50 bg-bg-tertiary'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-text-primary">{pkg.name}</p>
                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                    TRIAL
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {pkg.duration} {pkg.duration_type === 'HOURS' ? 'hora(s)' : pkg.duration_type === 'DAYS' ? 'dia(s)' : pkg.duration_type}
                                  </span>
                                  {pkg.server_name && (
                                    <span>• {pkg.server_name}</span>
                                  )}
                                </div>
                              </div>
                              {selectedTrialPackage?.id === pkg.id && (
                                <Check size={20} className="text-amber-500 shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Etapa 2: Resultado do teste criado */}
              {trialResult && (
                <div className="space-y-4">
                  {/* Info do cliente criado */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Check size={20} className="text-emerald-500" />
                      <span className="font-medium text-emerald-400">Teste criado com sucesso!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">Usuário:</span>
                        <p className="font-mono font-medium text-text-primary">{trialResult.customer?.username}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Senha:</span>
                        <p className="font-mono font-medium text-text-primary">{trialResult.customer?.password}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Pacote:</span>
                        <p className="font-medium text-text-primary">{trialResult.customer?.package}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Expira:</span>
                        <p className="font-medium text-text-primary">{formatDate(trialResult.customer?.expires_at)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Template completo */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-text-secondary">
                        Mensagem para o Cliente:
                      </label>
                      <button
                        onClick={() => copyToClipboard(getPreferredTemplate(trialResult.playlist))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-sm transition-fast"
                      >
                        {copied ? (
                          <>
                            <CheckCheck size={14} className="text-emerald-500" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                      <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                        {getPreferredTemplate(trialResult.playlist) || 'Template não disponível'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-border-color shrink-0 flex gap-3">
              {!trialResult ? (
                <>
                  <button
                    onClick={closeTrialModal}
                    className="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-text-primary font-medium transition-fast"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateTrial}
                    disabled={!selectedTrialPackage || creatingTrial}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-fast flex items-center justify-center gap-2"
                  >
                    {creatingTrial ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <FlaskConical size={16} />
                        Gerar Teste
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={closeTrialModal}
                  className="w-full px-4 py-2.5 bg-violet-500 hover:bg-violet-600 rounded-lg text-white font-medium transition-fast"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {showViewModal && viewingCustomer && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-color flex justify-between items-center shrink-0">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Eye size={20} className="text-cyan-500" />
                Dados do Cliente
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingPlaylist ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <span className="ml-3 text-text-muted">Carregando dados...</span>
                </div>
              ) : customerPlaylist ? (
                <div className="space-y-4">
                  {/* Info básica */}
                  <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">Username:</span>
                        <p className="font-medium text-text-primary">{viewingCustomer.username}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Status:</span>
                        <p>{getStatusBadge(viewingCustomer.status)}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Pacote:</span>
                        <p className="font-medium text-text-primary">{viewingCustomer.package || '—'}</p>
                      </div>
                      <div>
                        <span className="text-text-muted">Expira:</span>
                        <p className="font-medium text-text-primary">{formatDate(viewingCustomer.expires_at)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Template completo */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-text-secondary">
                        Mensagem para o Cliente:
                      </label>
                      <button
                        onClick={() => copyToClipboard(getPreferredTemplate(customerPlaylist))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-sm transition-fast"
                      >
                        {copied ? (
                          <>
                            <CheckCheck size={14} className="text-emerald-500" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                      <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                        {getPreferredTemplate(customerPlaylist) || 'Template não disponível'}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Não foi possível carregar os dados do cliente</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-border-color shrink-0">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-text-primary font-medium transition-fast"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Renovação */}
      {showRenewModal && selectedCustomer && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowRenewModal(false)}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Calendar size={20} className="text-violet-500" />
                Renovar Cliente
              </h2>
              <button onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Info do cliente */}
              <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                <p className="text-sm text-text-secondary">Cliente:</p>
                <p className="font-medium text-text-primary">{selectedCustomer.username}</p>
                <p className="text-xs text-text-muted mt-1">
                  Pacote atual: {selectedCustomer.package || '—'}
                </p>
                <p className="text-xs text-text-muted">
                  Expira: {formatDate(selectedCustomer.expires_at)}
                </p>
              </div>
              
              {/* Lista de pacotes */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Selecione um pacote:
                </label>
                
                {loadingPackages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                    <span className="ml-2 text-text-muted">Carregando pacotes...</span>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum pacote disponível</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackage(pkg)}
                        className={`w-full p-3 rounded-lg border text-left transition-fast ${
                          selectedPackage?.id === pkg.id
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-border-color hover:border-violet-500/50 bg-bg-tertiary'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-text-primary">{pkg.name}</p>
                              {pkg.is_trial && (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                                  TRIAL
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted mt-1">
                              {pkg.duration} {pkg.duration_type === 'MONTHS' ? 'mês(es)' : pkg.duration_type === 'DAYS' ? 'dia(s)' : pkg.duration_type}
                              {pkg.server_name && ` • ${pkg.server_name}`}
                            </p>
                          </div>
                          {selectedPackage?.id === pkg.id && (
                            <Check size={18} className="text-violet-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-border-color flex gap-3">
              <button
                onClick={() => setShowRenewModal(false)}
                className="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-text-primary font-medium transition-fast"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenew}
                disabled={!selectedPackage || renewing}
                className="flex-1 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-fast flex items-center justify-center gap-2"
              >
                {renewing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Renovando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Confirmar Renovação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
