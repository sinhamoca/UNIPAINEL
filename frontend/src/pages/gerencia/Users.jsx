// pages/gerencia/Users.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gerenciaAPI, playlistAPI } from '../../services/api';
import { 
  Search, 
  Loader2, 
  Users, 
  RefreshCw, 
  Plus,
  Edit,
  Trash2,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Globe,
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GerenciaUsers() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  // Modal
  const [editingUser, setEditingUser] = useState(null);
  const [renewUser, setRenewUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [changeDnsUser, setChangeDnsUser] = useState(null);

  // Carregar contas
  useEffect(() => {
    loadAccounts();
  }, []);

  // Busca em tempo real (debounced)
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
        const response = await gerenciaAPI.searchUsers(selectedAccount.id, searchQuery);
        if (response.data.success) {
          setSearchResults(response.data.users);
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

  // Click outside para fechar search
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
      const response = await gerenciaAPI.getAccounts();
      if (response.data.success) {
        setAccounts(response.data.accounts);
        // Selecionar primeira conta conectada
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

  const loadUsers = async (page = 1) => {
    if (!selectedAccount) return;
    
    setUsersLoading(true);
    try {
      // Passar total de usuários das stats para calcular paginação corretamente
      const totalUsers = stats?.total || 0;
      const response = await gerenciaAPI.getUsers(selectedAccount.id, { page, totalUsers });
      if (response.data.success) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários. Verifique se a conta está conectada.');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedAccount) return;
    try {
      const response = await gerenciaAPI.getStats(selectedAccount.id);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  // Recarregar quando conta muda
  useEffect(() => {
    if (selectedAccount) {
      loadStats();
      loadUsers();
    }
  }, [selectedAccount]);

  const handleSync = async () => {
    if (!selectedAccount) return;
    const toastId = toast.loading('Sincronizando...');
    try {
      await gerenciaAPI.syncUsers(selectedAccount.id);
      await loadStats();
      await loadUsers();
      toast.success('Sincronizado!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao sincronizar', { id: toastId });
    }
  };

  const handleRenew = async (days) => {
    const toastId = toast.loading('Renovando...');
    try {
      await gerenciaAPI.renewUser(selectedAccount.id, renewUser.id, days);
      toast.success(`Renovado por ${days} dias!`, { id: toastId });
      setRenewUser(null);
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao renovar', { id: toastId });
    }
  };

  const handleDelete = async () => {
    const toastId = toast.loading('Excluindo...');
    try {
      await gerenciaAPI.deleteUser(selectedAccount.id, deleteUser.id);
      toast.success('Usuário excluído!', { id: toastId });
      setDeleteUser(null);
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao excluir', { id: toastId });
    }
  };

  const selectSearchResult = (user) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setEditingUser(user.data || user);
  };

  const isExpired = (date) => {
    if (!date) return true;
    return new Date(date) < new Date();
  };

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const expDate = new Date(date);
    const now = new Date();
    const diff = (expDate - now) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 7;
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-ibo-primary" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-bg-card border border-border-color rounded-2xl p-8 sm:p-12 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma conta configurada</h3>
          <p className="text-text-muted mb-6">
            Configure uma conta do GerenciaApp primeiro
          </p>
          <button
            onClick={() => navigate('/gerencia/contas')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast"
          >
            Configurar Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header - CORRIGIDO PARA MOBILE */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Título e ícone */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ibo-glow rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="text-ibo-primary" size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Usuários</h1>
            <p className="text-text-muted text-xs sm:text-sm">GerenciaApp - IBO Revenda</p>
          </div>
        </div>

        {/* Controles - Stack no mobile, row no desktop */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Seletor de conta */}
          <select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const acc = accounts.find(a => a.id === parseInt(e.target.value));
              setSelectedAccount(acc);
            }}
            className="h-10 sm:h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 sm:px-4 text-sm text-text-primary focus:border-ibo-primary transition-fast flex-1 sm:flex-none"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          {/* Botões de ação */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              className="flex-1 sm:flex-none h-10 sm:h-11 px-3 sm:px-4 bg-bg-tertiary border border-border-color hover:border-border-light rounded-xl text-text-secondary hover:text-text-primary transition-fast flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              <span className="text-sm">Sincronizar</span>
            </button>

            <button
              onClick={() => navigate('/gerencia/criar')}
              className="flex-1 sm:flex-none h-10 sm:h-11 px-3 sm:px-5 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              <span className="text-sm">Novo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats - Apenas Total */}
      {stats && stats.total > 0 && (
        <div className="bg-bg-card border border-border-color rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-ibo-glow rounded-lg flex items-center justify-center">
            <Users size={20} className="text-ibo-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
            <p className="text-xs text-text-muted">usuários cadastrados</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div ref={searchRef} className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, MAC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-bg-card border border-border-color rounded-xl pl-11 pr-4 text-text-primary placeholder:text-text-muted focus:border-ibo-primary transition-fast"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-ibo-primary" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-color rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => selectSearchResult(user)}
                className="w-full p-3 hover:bg-bg-hover text-left flex items-center gap-3 border-b border-border-color last:border-0 transition-fast"
              >
                <div className="w-9 h-9 bg-ibo-glow rounded-lg flex items-center justify-center text-ibo-primary font-semibold flex-shrink-0">
                  {user.server_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.server_name || 'Sem nome'}</p>
                  <p className="text-xs text-text-muted truncate">{user.mac_device}</p>
                </div>
                <StatusBadge date={user.expire_date || user.expire_account} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="bg-bg-card border border-border-color rounded-xl overflow-hidden">
        {usersLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-ibo-primary mx-auto mb-4" />
            <p className="text-text-muted">Carregando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">Nenhum usuário encontrado</p>
            <p className="text-xs text-text-muted mt-1">Clique em Sincronizar para atualizar</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary border-b border-border-color">
                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-4 py-3">Usuário</th>
                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-4 py-3">MAC</th>
                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-4 py-3">Validade</th>
                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border-color hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-ibo-glow rounded-lg flex items-center justify-center text-ibo-primary font-semibold flex-shrink-0">
                            {user.server_name?.[0] || '?'}
                          </div>
                          <span className="font-medium truncate max-w-[150px]">{user.server_name || 'Sem nome'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-text-muted font-mono bg-bg-tertiary px-2 py-1 rounded">
                          {user.mac_device || '—'}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {user.expire_date || user.expire_account || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge date={user.expire_date || user.expire_account} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-fast"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setChangeDnsUser(user)}
                            className="p-2 text-text-muted hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-fast"
                            title="Trocar DNS"
                          >
                            <Globe size={16} />
                          </button>
                          <button
                            onClick={() => setRenewUser(user)}
                            className="p-2 text-text-muted hover:text-ibo-primary hover:bg-ibo-glow rounded-lg transition-fast"
                            title="Renovar"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteUser(user)}
                            className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border-color">
              {users.map((user) => (
                <div key={user.id} className="p-4 hover:bg-bg-hover transition-fast">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-ibo-glow rounded-lg flex items-center justify-center text-ibo-primary font-semibold flex-shrink-0">
                        {user.server_name?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.server_name || 'Sem nome'}</p>
                        <code className="text-xs text-text-muted font-mono">
                          {user.mac_device || '—'}
                        </code>
                      </div>
                    </div>
                    <StatusBadge date={user.expire_date || user.expire_account} />
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                      Exp: {user.expire_date || user.expire_account || '—'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-fast"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setChangeDnsUser(user)}
                        className="p-2 text-text-muted hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-fast"
                      >
                        <Globe size={16} />
                      </button>
                      <button
                        onClick={() => setRenewUser(user)}
                        className="p-2 text-text-muted hover:text-ibo-primary hover:bg-ibo-glow rounded-lg transition-fast"
                      >
                        <Calendar size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteUser(user)}
                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
              onClick={() => loadUsers(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-4 text-sm text-text-secondary">
              {pagination.currentPage} / {pagination.lastPage}
            </span>
            <button
              onClick={() => loadUsers(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.lastPage}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          accountId={selectedAccount?.id}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); loadUsers(); loadStats(); }}
        />
      )}

      {/* Modal de Renovação */}
      {renewUser && (
        <RenewModal
          user={renewUser}
          onClose={() => setRenewUser(null)}
          onRenew={handleRenew}
        />
      )}

      {/* Modal de Exclusão */}
      {deleteUser && (
        <DeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Modal de Trocar DNS */}
      {changeDnsUser && (
        <QuickChangeDnsModal
          user={changeDnsUser}
          accountId={selectedAccount?.id}
          onClose={() => setChangeDnsUser(null)}
          onSaved={() => { setChangeDnsUser(null); loadUsers(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ date }) {
  if (!date) {
    return <span className="px-2 sm:px-3 py-1 rounded-lg text-xs font-medium bg-bg-tertiary text-text-muted whitespace-nowrap">Sem data</span>;
  }
  
  const expDate = new Date(date);
  const now = new Date();
  
  if (expDate < now) {
    return <span className="px-2 sm:px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">🔴 Expirado</span>;
  }
  
  const diff = (expDate - now) / (1000 * 60 * 60 * 24);
  
  if (diff <= 7) {
    return <span className="px-2 sm:px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 whitespace-nowrap">🟡 {Math.ceil(diff)}d</span>;
  }
  
  return <span className="px-2 sm:px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 whitespace-nowrap">🟢 Ativo</span>;
}

function EditUserModal({ user, accountId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [form, setForm] = useState({
    serverName: user.server_name || '',
    macDevice: user.mac_device || '',
    m3u8List: user.m3u8_list || '',
    expireDate: user.expire_date || user.expire_account || '',
  });

  // Função de OCR
  const handleScanImage = async (file) => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return;
    }
    
    setScanningImage(true);
    
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const res = await playlistAPI.scanImage(base64);
      const { mac } = res.data;
      
      if (!mac) {
        toast.error('Não foi possível extrair MAC da imagem. Tente outra foto ou preencha manualmente.');
        return;
      }
      
      setForm(prev => ({ ...prev, macDevice: mac }));
      toast.success('📱 MAC Address extraído com sucesso!');
      
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      if (errorMsg.includes('OCR_API_KEY')) {
        toast.error('OCR não configurado. Configure a OCR_API_KEY no servidor.');
      } else {
        toast.error('Erro ao escanear imagem');
      }
    } finally {
      setScanningImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await gerenciaAPI.updateUser(accountId, user.id, {
        server_name: form.serverName,
        mac_device: form.macDevice,
        m3u8_list: form.m3u8List,
        expire_date: form.expireDate,
      });
      toast.success('Usuário atualizado!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* CORRIGIDO: max-h e overflow para mobile */}
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-color sticky top-0 bg-bg-card z-10">
          <h3 className="text-lg font-semibold">Editar Usuário</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        {/* Botão Scan Image */}
        <div className="px-4 sm:px-6 pt-4">
          <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-ibo-primary to-emerald-600 text-white rounded-xl cursor-pointer transition-all ${scanningImage ? 'opacity-70' : 'hover:from-ibo-secondary hover:to-emerald-700'}`}>
            {scanningImage ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                <Camera size={18} />
                Escanear MAC por Foto
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={scanningImage}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleScanImage(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Nome</label>
            <input
              type="text"
              value={form.serverName}
              onChange={(e) => setForm({ ...form, serverName: e.target.value })}
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary transition-fast"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">MAC Address</label>
            <input
              type="text"
              value={form.macDevice}
              onChange={(e) => setForm({ ...form, macDevice: e.target.value })}
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary font-mono focus:border-ibo-primary transition-fast"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Playlist M3U8</label>
            <input
              type="text"
              value={form.m3u8List}
              onChange={(e) => setForm({ ...form, m3u8List: e.target.value })}
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary font-mono text-sm focus:border-ibo-primary transition-fast"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Data de Expiração</label>
            <input
              type="date"
              value={form.expireDate}
              onChange={(e) => setForm({ ...form, expireDate: e.target.value })}
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary transition-fast"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenewModal({ user, onClose, onRenew }) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleRenew = async () => {
    setLoading(true);
    await onRenew(days);
    setLoading(false);
  };

  const presets = [7, 15, 30, 60, 90, 180, 365];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-color sticky top-0 bg-bg-card">
          <h3 className="text-lg font-semibold">Renovar Usuário</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-text-secondary mb-4">
            Renovar <strong>{user.server_name}</strong>
          </p>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {presets.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-fast ${
                  days === d
                    ? 'bg-ibo-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <input
            type="number"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
            min="1"
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary text-center font-semibold focus:border-ibo-primary transition-fast"
          />

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button 
              onClick={handleRenew} 
              disabled={loading || days < 1}
              className="flex-1 h-11 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Renovar +${days}d`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ user, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold text-red-400">Excluir Usuário</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <p className="text-sm text-red-400">
              ⚠️ Esta ação não pode ser desfeita. O usuário será removido permanentemente.
            </p>
          </div>

          <p className="text-text-secondary mb-4">
            Excluir o usuário <strong>{user.server_name}</strong>?
          </p>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={loading}
              className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 size={18} /> Excluir</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickChangeDnsModal({ user, accountId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(user.m3u8_list || '');
  const [newDomain, setNewDomain] = useState('');

  // Extrair domínio atual da URL
  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  };

  const currentDomain = extractDomain(currentUrl);

  const handleChangeDns = async (e) => {
    e.preventDefault();
    
    if (!newDomain.trim()) {
      toast.error('Informe o novo domínio');
      return;
    }

    setLoading(true);
    
    try {
      // Substituir o domínio na URL
      let updatedUrl = currentUrl;
      if (currentDomain) {
        updatedUrl = currentUrl.replace(currentDomain, newDomain.trim());
      } else {
        // Se não tinha URL, criar uma nova
        updatedUrl = `http://${newDomain.trim()}/get.php?username=xxx&password=xxx`;
      }

      await gerenciaAPI.updateUser(accountId, user.id, {
        server_name: user.server_name,
        mac_device: user.mac_device,
        m3u8_list: updatedUrl,
        expire_date: user.expire_date || user.expire_account,
      });

      toast.success('DNS atualizado!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar DNS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-color sticky top-0 bg-bg-card">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="text-cyan-400" size={20} />
            Trocar DNS
          </h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleChangeDns} className="p-4 sm:p-6 space-y-4">
          <div className="p-4 bg-bg-tertiary rounded-xl">
            <p className="text-sm text-text-muted mb-1">Usuário:</p>
            <p className="font-medium">{user.server_name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">DNS Atual</label>
            <input
              type="text"
              value={currentDomain || 'Nenhum'}
              readOnly
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-muted font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Novo DNS</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="novo-servidor.com"
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary font-mono text-sm focus:border-cyan-500 transition-fast"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}