// pages/sigma/Resellers.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sigmaAPI } from '../../services/api';
import { 
  Users, 
  Loader2, 
  Search, 
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SigmaResellers() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  
  // Estados principais
  const [account, setAccount] = useState(null);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 1
  });
  
  // Estados do modal de créditos
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsAction, setCreditsAction] = useState('add'); // 'add' ou 'remove'
  const [processing, setProcessing] = useState(false);

  // Carregar revendedores
  const loadResellers = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      const response = await sigmaAPI.getResellers(accountId, {
        page,
        perPage: pagination.perPage,
        search
      });
      
      if (response.data.success) {
        setAccount(response.data.account);
        setResellers(response.data.resellers);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao carregar revendedores');
      if (error.response?.status === 404) {
        navigate('/sigma');
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, pagination.perPage, navigate]);

  useEffect(() => {
    loadResellers(1, '');
  }, [accountId]);

  // Buscar com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        setSearching(true);
        loadResellers(1, searchQuery).finally(() => setSearching(false));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Abrir modal de créditos
  const openCreditsModal = (reseller, action) => {
    setSelectedReseller(reseller);
    setCreditsAction(action);
    setCreditsAmount('');
    setShowCreditsModal(true);
  };

  // Processar créditos
  const handleCredits = async () => {
    const amount = parseInt(creditsAmount);
    
    if (!amount || amount <= 0) {
      toast.error('Digite uma quantidade válida');
      return;
    }
    
    setProcessing(true);
    const toastId = toast.loading(creditsAction === 'add' ? 'Adicionando créditos...' : 'Removendo créditos...');
    
    try {
      let response;
      if (creditsAction === 'add') {
        response = await sigmaAPI.addCredits(accountId, selectedReseller.id, amount);
      } else {
        response = await sigmaAPI.removeCredits(accountId, selectedReseller.id, amount);
      }
      
      if (response.data.success) {
        toast.success(response.data.message || 'Operação realizada com sucesso!', { id: toastId });
        setShowCreditsModal(false);
        loadResellers(pagination.page, searchQuery);
      } else {
        toast.error(response.data.error || 'Erro na operação', { id: toastId });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao processar créditos', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  // Paginação
  const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadResellers(newPage, searchQuery);
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
  const getStatusBadge = (reseller) => {
    if (reseller.membership_active || reseller.status === 'ACTIVE') {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Ativo</span>;
    }
    return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">Inativo</span>;
  };

  if (loading && resellers.length === 0) {
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
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <UserCheck className="text-amber-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Revendedores</h1>
            <p className="text-text-muted text-xs">{account?.name} • {account?.domain}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Link para Clientes */}
          <button
            onClick={() => navigate(`/sigma/${accountId}/customers`)}
            className="px-3 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded-lg transition-fast flex items-center gap-2 text-sm"
          >
            <Users size={16} />
            Clientes
          </button>
          
          <button
            onClick={() => loadResellers(pagination.page, searchQuery)}
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

      {/* Lista de Revendedores */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        {resellers.length === 0 ? (
          <div className="px-6 py-12 text-center text-text-muted">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum revendedor encontrado</p>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Créditos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {resellers.map((reseller) => (
                    <tr key={reseller.id} className="hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-3 text-sm text-text-muted font-mono">
                        #{reseller.id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-text-primary">{reseller.username}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {reseller.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
                          <Coins size={14} />
                          {reseller.credits ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(reseller)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openCreditsModal(reseller, 'add')}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-fast"
                            title="Adicionar créditos"
                          >
                            <PlusCircle size={18} />
                          </button>
                          <button
                            onClick={() => openCreditsModal(reseller, 'remove')}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-fast"
                            title="Remover créditos"
                          >
                            <MinusCircle size={18} />
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
              {resellers.map((reseller) => (
                <div key={reseller.id} className="p-4 hover:bg-bg-hover transition-fast">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 font-bold text-lg flex-shrink-0">
                      {reseller.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{reseller.username}</p>
                      <p className="text-xs text-text-muted">{reseller.name || 'Sem nome'}</p>
                      <p className="text-xs text-text-muted">ID: #{reseller.id}</p>
                    </div>
                    {getStatusBadge(reseller)}
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">Créditos:</span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
                        <Coins size={14} />
                        {reseller.credits ?? 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => openCreditsModal(reseller, 'add')}
                      className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-fast flex items-center justify-center gap-2"
                    >
                      <PlusCircle size={16} />
                      Adicionar
                    </button>
                    <button
                      onClick={() => openCreditsModal(reseller, 'remove')}
                      className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-fast flex items-center justify-center gap-2"
                    >
                      <MinusCircle size={16} />
                      Remover
                    </button>
                  </div>
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

      {/* Modal de Créditos */}
      {showCreditsModal && selectedReseller && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreditsModal(false)}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                {creditsAction === 'add' ? (
                  <>
                    <PlusCircle size={20} className="text-green-500" />
                    Adicionar Créditos
                  </>
                ) : (
                  <>
                    <MinusCircle size={20} className="text-red-500" />
                    Remover Créditos
                  </>
                )}
              </h2>
              <button onClick={() => setShowCreditsModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Info do revendedor */}
              <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                <p className="text-sm text-text-secondary">Revendedor:</p>
                <p className="font-medium text-text-primary">{selectedReseller.username}</p>
                <p className="text-xs text-text-muted mt-1">
                  Créditos atuais: <span className="text-amber-400 font-medium">{selectedReseller.credits ?? 0}</span>
                </p>
              </div>
              
              {/* Input de créditos */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Quantidade de créditos:
                </label>
                <input
                  type="number"
                  min="1"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-lg text-text-primary text-lg font-medium placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-fast"
                  autoFocus
                />
              </div>
              
              {/* Botões rápidos */}
              <div className="flex gap-2 flex-wrap">
                {[1, 5, 10, 20, 50, 100].map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCreditsAmount(amount.toString())}
                    className="px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-lg text-sm transition-fast"
                  >
                    {amount}
                  </button>
                ))}
              </div>
              
              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCredits}
                  disabled={processing || !creditsAmount}
                  className={`px-4 py-2 text-white rounded-lg transition-fast flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    creditsAction === 'add' 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {processing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar
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