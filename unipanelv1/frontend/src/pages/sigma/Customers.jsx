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
  UserCheck
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
      if (searchQuery) {
        setSearching(true);
        loadCustomers(1, searchQuery).finally(() => setSearching(false));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Abrir modal de renovação
  const openRenewModal = async (customer) => {
    setSelectedCustomer(customer);
    setShowRenewModal(true);
    setSelectedPackage(null);
    
    // Carregar pacotes
    setLoadingPackages(true);
    try {
      const response = await sigmaAPI.getPackages(accountId);
      if (response.data.success) {
        setPackages(response.data.packages);
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
        selectedPackage.id,
        1
      );
      
      if (response.data.success) {
        toast.success('Cliente renovado com sucesso!');
        setShowRenewModal(false);
        loadCustomers(pagination.page, searchQuery);
      } else {
        toast.error(response.data.error || 'Erro ao renovar');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao renovar cliente');
    } finally {
      setRenewing(false);
    }
  };

  // Paginação
  const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadCustomers(newPage, searchQuery);
    }
  };

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

  // Status badge
  const getStatusBadge = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'active' || statusLower === 'ativo') {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Ativo</span>;
    } else if (statusLower === 'expired' || statusLower === 'expirado') {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">Expirado</span>;
    } else if (statusLower === 'banned' || statusLower === 'banido') {
      return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">Banido</span>;
    }
    return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">{status || '—'}</span>;
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sigma')}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-fast"
          >
            <ArrowLeft size={20} className="text-text-muted" />
          </button>
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
            <Users className="text-violet-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
            <p className="text-text-muted text-xs">{account?.name} • {account?.domain}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Link para Revendedores */}
          <button
            onClick={() => navigate(`/sigma/${accountId}/resellers`)}
            className="px-3 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded-lg transition-fast flex items-center gap-2 text-sm"
          >
            <UserCheck size={16} className="text-amber-500" />
            Revendedores
          </button>
          
          <button
            onClick={() => loadCustomers(pagination.page, searchQuery)}
            className="p-2 bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-fast"
            title="Atualizar"
          >
            <RefreshCw size={18} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Pacote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Expira</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Conexões</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-3 text-sm text-text-muted font-mono">
                        #{customer.id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-text-primary">{customer.username}</span>
                        {customer.note && (
                          <p className="text-xs text-text-muted truncate max-w-[150px]">{customer.note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {customer.package_name || customer.package?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(customer.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {customer.connections || 1}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(customer.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openRenewModal(customer)}
                          className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-fast flex items-center gap-1 ml-auto"
                        >
                          <Calendar size={14} />
                          Renovar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border-color">
              {customers.map((customer) => (
                <div key={customer.id} className="p-4 hover:bg-bg-hover transition-fast">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500 font-bold text-lg flex-shrink-0">
                      {customer.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{customer.username}</p>
                      <p className="text-xs text-text-muted">ID: #{customer.id}</p>
                    </div>
                    {getStatusBadge(customer.status)}
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Pacote:</span>
                      <span className="text-sm">{customer.package_name || customer.package?.name || '—'}</span>
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
                  
                  <button
                    onClick={() => openRenewModal(customer)}
                    className="w-full py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-fast flex items-center justify-center gap-2"
                  >
                    <Calendar size={16} />
                    Renovar Cliente
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        
        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border-color flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Página {pagination.page} de {pagination.totalPages}
              {pagination.total > 0 && (
                <span className="ml-1">({pagination.total} total)</span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 bg-bg-tertiary rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 bg-bg-tertiary rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

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
                            : 'border-border-color bg-bg-tertiary hover:border-border-light'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-text-primary">{pkg.name}</p>
                            <p className="text-xs text-text-muted">
                              {pkg.server_name} • {pkg.duration} {pkg.duration_type === 'MONTHS' ? 'mês(es)' : pkg.duration_type}
                            </p>
                          </div>
                          <div className="text-right">
                            {pkg.credits > 0 && (
                              <p className="text-sm font-medium text-emerald-400">{pkg.credits} créditos</p>
                            )}
                            {pkg.is_trial && (
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Trial</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRenew}
                  disabled={renewing || !selectedPackage}
                  className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-fast flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {renewing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Renovando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
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
