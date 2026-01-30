// pages/koffice/Resellers.jsx - Gerenciamento de Revendas do Koffice
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { kofficeAPI } from '../../services/api';
import { 
  Users, ArrowLeft, Search, Plus, Loader2, RefreshCw, X,
  Calendar, CreditCard, UserPlus, Clock, ChevronLeft, ChevronRight,
  PlusCircle, MinusCircle, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function KofficeResellers() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  
  // Estados
  const [account, setAccount] = useState(null);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalRecords: 0 });
  const [credits, setCredits] = useState(0);
  
  // Ref para debounce da busca
  const searchTimeoutRef = useRef(null);
  const lastSearchRef = useRef('');
  
  // Modais
  const [showCreateReseller, setShowCreateReseller] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  
  // Formulários
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    name: '',
    credits: 0,
    expiry: ''
  });
  const [creditsAction, setCreditsAction] = useState('add');
  const [creditsAmount, setCreditsAmount] = useState(1);
  const [resellerDetails, setResellerDetails] = useState(null);
  
  // Loading states
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Carregar dados da conta e revendas
  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      
      // Carregar dashboard para info da conta
      const dashRes = await kofficeAPI.getDashboard(accountId);
      if (dashRes.data.success) {
        setAccount(dashRes.data.account);
      }
      
      // Carregar créditos
      const creditsRes = await kofficeAPI.getCredits(accountId);
      if (creditsRes.data.success) {
        setCredits(creditsRes.data.credits);
      }
      
      // Carregar revendas
      const resellersRes = await kofficeAPI.getResellers(accountId, { page, perPage: 20 });
      if (resellersRes.data.success) {
        setResellers(resellersRes.data.resellers || []);
        setPagination({
          page: resellersRes.data.pagination?.page || 1,
          totalPages: resellersRes.data.pagination?.totalPages || 1,
          totalRecords: resellersRes.data.pagination?.totalRecords || 0
        });
      }
    } catch (err) {
      toast.error('Erro ao carregar dados: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [accountId]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Buscar revendas com debounce
  const handleSearch = (query) => {
    setSearchQuery(query);
    
    // Cancelar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Se query vazia ou muito curta, resetar para lista completa
    if (query.length < 2) {
      if (lastSearchRef.current !== '') {
        lastSearchRef.current = '';
        loadData();
      }
      return;
    }
    
    // Debounce de 400ms
    searchTimeoutRef.current = setTimeout(async () => {
      // Evitar busca duplicada
      if (query === lastSearchRef.current) return;
      lastSearchRef.current = query;
      
      try {
        setSearching(true);
        const res = await kofficeAPI.searchResellers(accountId, query);
        if (res.data.success) {
          setResellers(res.data.resellers || []);
        }
      } catch (err) {
        toast.error('Erro na busca: ' + err.message);
      } finally {
        setSearching(false);
      }
    }, 400);
  };
  
  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  // Criar revenda
  const handleCreateReseller = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await kofficeAPI.createReseller(accountId, createForm);
      if (res.data.success) {
        toast.success('Revenda criada com sucesso!');
        setShowCreateReseller(false);
        setCreateForm({ username: '', password: '', name: '', credits: 0, expiry: '' });
        loadData();
      } else {
        throw new Error(res.data.error);
      }
    } catch (err) {
      toast.error('Erro ao criar revenda: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };
  
  // Gerenciar créditos
  const handleCreditsAction = async () => {
    if (!selectedReseller) return;
    setSaving(true);
    
    try {
      const apiCall = creditsAction === 'add' 
        ? kofficeAPI.addCredits 
        : kofficeAPI.removeCredits;
      
      const res = await apiCall(accountId, selectedReseller.id, creditsAmount);
      if (res.data.success) {
        toast.success(`${creditsAmount} créditos ${creditsAction === 'add' ? 'adicionados' : 'removidos'}!`);
        setShowCreditsModal(false);
        setSelectedReseller(null);
        loadData();
      } else {
        throw new Error(res.data.error);
      }
    } catch (err) {
      toast.error('Erro ao gerenciar créditos: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };
  
  // Ver detalhes da revenda (usa dados já carregados)
  const handleViewDetails = (reseller) => {
    setSelectedReseller(reseller);
    setShowDetailsModal(true);
    setLoadingDetails(false);
  };
  
  // Abrir modal de créditos
  const openCreditsModal = (reseller, action = 'add') => {
    setSelectedReseller(reseller);
    setCreditsAction(action);
    setCreditsAmount(1);
    setShowCreditsModal(true);
  };
  
  // Paginação
  const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadData(newPage);
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
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/koffice')}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-fast"
          >
            <ArrowLeft size={20} className="text-text-muted" />
          </button>
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
            <Users className="text-orange-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Revendas</h1>
            <p className="text-text-muted text-xs">{account?.name}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Saldo de Créditos */}
          <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg">
            <span className="text-xs text-green-400 flex items-center gap-1.5">
              <CreditCard size={14} />
              <span className="font-semibold">{credits}</span>
            </span>
          </div>
          
          <button
            onClick={() => loadData()}
            className="p-2 bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-fast"
            title="Atualizar"
          >
            <RefreshCw size={16} className="text-text-muted" />
          </button>
          
          <button
            onClick={() => setShowCreateReseller(true)}
            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-fast flex items-center gap-2 text-sm"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Nova Revenda</span>
          </button>
        </div>
      </div>
      
      {/* Links de navegação */}
      <div className="flex gap-2">
        <Link
          to={`/koffice/${accountId}/clients`}
          className="px-3 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-fast text-sm"
        >
          Clientes
        </Link>
        <button className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm">
          Revendas
        </button>
      </div>
      
      {/* Barra de busca */}
      <div className="bg-bg-secondary rounded-xl p-3 border border-border-color">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por username ou nome..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-fast text-sm"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-orange-500" />
          )}
        </div>
      </div>
      
      {/* Lista de Revendas */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        {resellers.length === 0 ? (
          <div className="px-6 py-12 text-center text-text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma revenda encontrada</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-bg-tertiary border-b border-border-color">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Créditos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Validade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Ações</th>
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
                        {reseller.name && reseller.name !== reseller.username && (
                          <p className="text-xs text-text-muted">{reseller.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary truncate max-w-[180px]" title={reseller.email}>
                        {reseller.email || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${
                          reseller.credits > 0 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {reseller.credits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {reseller.expiry || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {reseller.status === 'active' ? (
                          <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(reseller)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-fast"
                            title="Ver Detalhes"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openCreditsModal(reseller, 'add')}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-fast"
                            title="Adicionar Créditos"
                          >
                            <PlusCircle size={16} />
                          </button>
                          <button
                            onClick={() => openCreditsModal(reseller, 'remove')}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-fast"
                            title="Remover Créditos"
                          >
                            <MinusCircle size={16} />
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
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 font-bold text-lg flex-shrink-0">
                      {reseller.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{reseller.username}</p>
                      {reseller.name && reseller.name !== reseller.username && (
                        <p className="text-xs text-text-muted">{reseller.name}</p>
                      )}
                      <p className="text-xs text-text-muted">ID: #{reseller.id}</p>
                    </div>
                    {reseller.status === 'active' ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                        Inativo
                      </span>
                    )}
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Créditos:</span>
                      <span className={`text-sm font-medium ${
                        reseller.credits > 0 ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {reseller.credits}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-text-muted">Validade:</span>
                      <span className="text-sm">{reseller.expiry || '—'}</span>
                    </div>
                    {reseller.email && (
                      <div className="flex justify-between">
                        <span className="text-xs text-text-muted">Email:</span>
                        <span className="text-sm truncate max-w-[150px]">{reseller.email}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleViewDetails(reseller)}
                      className="p-2.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-fast"
                      title="Detalhes"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => openCreditsModal(reseller, 'add')}
                      className="p-2.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-fast"
                      title="+ Créditos"
                    >
                      <PlusCircle size={18} />
                    </button>
                    <button
                      onClick={() => openCreditsModal(reseller, 'remove')}
                      className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
                      title="- Créditos"
                    >
                      <MinusCircle size={18} />
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
              {pagination.totalRecords > 0 && (
                <span className="ml-1 text-text-secondary">
                  ({pagination.totalRecords})
                </span>
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
      
      {/* Modal: Criar Revenda */}
      {showCreateReseller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <UserPlus size={20} className="text-orange-500" />
                Nova Revenda
              </h2>
              <button onClick={() => setShowCreateReseller(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateReseller} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  placeholder="usuario_revenda"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Senha</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  placeholder="senha123"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome/Notas</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  placeholder="Nome do revendedor"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Créditos Iniciais</label>
                  <input
                    type="number"
                    value={createForm.credits}
                    onChange={(e) => setCreateForm({ ...createForm, credits: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Validade</label>
                  <input
                    type="date"
                    value={createForm.expiry}
                    onChange={(e) => setCreateForm({ ...createForm, expiry: e.target.value })}
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setShowCreateReseller(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Criar Revenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal: Gerenciar Créditos */}
      {showCreditsModal && selectedReseller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-sm">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <CreditCard size={20} className={creditsAction === 'add' ? 'text-green-500' : 'text-red-500'} />
                {creditsAction === 'add' ? 'Adicionar' : 'Remover'} Créditos
              </h2>
              <button onClick={() => setShowCreditsModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                <p className="text-sm text-text-secondary">Revenda:</p>
                <p className="font-medium text-text-primary">{selectedReseller.username}</p>
                <p className="text-xs text-text-muted mt-1">
                  Créditos atuais: <span className="text-green-400 font-medium">{selectedReseller.credits}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Quantidade</label>
                <input
                  type="number"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
              
              <div className={`p-3 rounded-lg ${creditsAction === 'add' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <p className={`text-sm ${creditsAction === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                  Novo saldo: <span className="font-bold">
                    {creditsAction === 'add' 
                      ? selectedReseller.credits + creditsAmount 
                      : Math.max(0, selectedReseller.credits - creditsAmount)}
                  </span> créditos
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreditsAction}
                  disabled={saving}
                  className={`px-4 py-2 text-white rounded-lg transition-fast flex items-center gap-2 disabled:opacity-50 ${
                    creditsAction === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {creditsAction === 'add' ? 'Adicionar' : 'Remover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Detalhes da Revenda */}
      {showDetailsModal && selectedReseller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Eye size={20} className="text-blue-500" />
                Detalhes da Revenda
              </h2>
              <button onClick={() => { setShowDetailsModal(false); setResellerDetails(null); }} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : selectedReseller ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">ID</p>
                      <p className="font-mono text-text-primary">{selectedReseller.id}</p>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Status</p>
                      <p className={`font-medium ${selectedReseller.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedReseller.status === 'active' ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <p className="text-xs text-text-muted">Username</p>
                    <p className="font-medium text-text-primary">{selectedReseller.username}</p>
                  </div>
                  
                  {selectedReseller.email && (
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Email</p>
                      <p className="text-text-primary break-all">{selectedReseller.email}</p>
                    </div>
                  )}
                  
                  {selectedReseller.name && selectedReseller.name !== selectedReseller.username && (
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Nome/Notas</p>
                      <p className="text-text-primary">{selectedReseller.name}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Créditos</p>
                      <p className={`font-bold text-lg ${selectedReseller.credits > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {selectedReseller.credits}
                      </p>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Validade</p>
                      <p className="text-text-primary">{selectedReseller.expiry || 'Sem limite'}</p>
                    </div>
                  </div>
                  
                  {selectedReseller.owner && (
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Owner/Master</p>
                      <p className="text-cyan-400">{selectedReseller.owner}</p>
                    </div>
                  )}
                  
                  {selectedReseller.ip && (
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <p className="text-xs text-text-muted">Último IP</p>
                      <p className="text-text-secondary font-mono text-sm break-all">{selectedReseller.ip}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-text-muted py-8">Erro ao carregar detalhes</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
