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
      const response = await gerenciaAPI.getDashboard(selectedAccount.id);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  // Carregar stats primeiro, depois usuários
  useEffect(() => {
    if (selectedAccount) {
      loadStats();
    }
  }, [selectedAccount]);
  
  // Carregar usuários quando stats estiverem prontas ou conta mudar
  useEffect(() => {
    if (selectedAccount && stats) {
      loadUsers();
    }
  }, [selectedAccount, stats?.total]);

  const handleSync = async () => {
    if (!selectedAccount) return;
    
    const toastId = toast.loading('Sincronizando cache...');
    try {
      const response = await gerenciaAPI.syncCache(selectedAccount.id, 10);
      toast.success(response.data.message, { id: toastId });
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error('Erro ao sincronizar', { id: toastId });
    }
  };

  const handleRenew = async (days) => {
    if (!renewUser || !selectedAccount) return;
    
    const toastId = toast.loading('Renovando...');
    try {
      const response = await gerenciaAPI.renewUser(selectedAccount.id, renewUser.id, days);
      toast.success(response.data.message, { id: toastId });
      setRenewUser(null);
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao renovar', { id: toastId });
    }
  };

  const handleDelete = async () => {
    if (!deleteUser || !selectedAccount) return;
    
    const toastId = toast.loading('Excluindo...');
    try {
      await gerenciaAPI.deleteUser(selectedAccount.id, deleteUser.id);
      toast.success('Usuário excluído', { id: toastId });
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-ibo-primary" />
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-ibo-glow rounded-xl flex items-center justify-center">
            <Users className="text-ibo-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-text-muted text-sm">GerenciaApp - IBO Revenda</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de conta */}
          <select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const acc = accounts.find(a => a.id === parseInt(e.target.value));
              setSelectedAccount(acc);
            }}
            className="h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-sm text-text-primary focus:border-ibo-primary transition-fast"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSync}
            className="h-11 px-4 bg-bg-tertiary border border-border-color hover:border-border-light rounded-xl text-text-secondary hover:text-text-primary transition-fast flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Sincronizar
          </button>

          <button
            onClick={() => navigate('/gerencia/criar')}
            className="h-11 px-5 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center gap-2"
          >
            <Plus size={18} />
            Novo
          </button>
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

      {/* Search - Estilo Inline */}
      <div className="relative mb-6" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
            placeholder="Buscar por nome, MAC ou email... (digite para buscar)"
            className="w-full h-14 bg-bg-card border border-border-color rounded-xl pl-12 pr-12 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-ibo-primary animate-spin" size={20} />
          )}
        </div>

        {/* Dropdown de resultados */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-color rounded-xl shadow-lg max-h-96 overflow-y-auto z-50 animate-slide-down">
            <div className="p-2">
              <p className="text-xs text-text-muted px-3 py-2">
                {searchResults.length} resultado(s) encontrado(s)
              </p>
              {searchResults.map((user, index) => (
                <button
                  key={user.id || index}
                  onClick={() => selectSearchResult(user)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-fast text-left"
                >
                  <div className="w-10 h-10 bg-ibo-glow rounded-lg flex items-center justify-center text-ibo-primary font-semibold">
                    {user.name?.[0] || user.server_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name || user.server_name}</p>
                    <p className="text-xs text-text-muted font-mono">{user.mac || user.mac_device}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isExpired(user.expireDate || user.expire_date)
                      ? 'bg-red-500/10 text-red-400'
                      : isExpiringSoon(user.expireDate || user.expire_date)
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {user.expireDate || user.expire_date || 'N/A'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border-color rounded-xl shadow-lg p-6 text-center z-50 animate-slide-down">
            <p className="text-text-muted">Nenhum resultado para "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-color rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border-color flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-semibold">Lista de Usuários</h3>
          {pagination && (
            <p className="text-sm text-text-muted">
              Página {pagination.currentPage} de {pagination.lastPage} ({pagination.total} total)
            </p>
          )}
        </div>

        {usersLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-ibo-primary mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            Nenhum usuário encontrado
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary">
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Usuário</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">MAC</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Validade</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-border-color hover:bg-bg-hover transition-fast">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-ibo-glow rounded-lg flex items-center justify-center text-ibo-primary font-semibold">
                            {user.server_name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{user.server_name || 'Sem nome'}</p>
                            {user.email && (
                              <p className="text-xs text-text-muted">{user.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-sm text-text-secondary font-mono bg-bg-tertiary px-2 py-1 rounded">
                          {user.mac_device || '—'}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {user.expire_date || user.expire_account || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge date={user.expire_date || user.expire_account} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
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
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-bg-tertiary text-text-muted">Sem data</span>;
  }
  
  const expDate = new Date(date);
  const now = new Date();
  
  if (expDate < now) {
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400">🔴 Expirado</span>;
  }
  
  const diff = (expDate - now) / (1000 * 60 * 60 * 24);
  
  if (diff <= 7) {
    return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400">🟡 Expira em {Math.ceil(diff)}d</span>;
  }
  
  return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">🟢 Ativo</span>;
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
        toast.error('Erro ao processar imagem: ' + errorMsg);
      }
    } finally {
      setScanningImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await gerenciaAPI.updateUser(accountId, user.id, form);
      toast.success('Usuário atualizado');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Editar Usuário</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        {/* Botão de Scan de Imagem */}
        <div className="px-4 sm:px-6 pt-4">
          <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all cursor-pointer">
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
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Renovar Usuário</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Renovar +${days} dias`}
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
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="text-red-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-2">Excluir Usuário?</h3>
          <p className="text-text-muted mb-6">
            Tem certeza que deseja excluir <strong>{user.server_name}</strong>?
            <br />Esta ação não pode ser desfeita.
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickChangeDnsModal({ user, accountId, onClose, onSaved }) {
  const [newDns, setNewDns] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentUrl = user.m3u8_list || '';

  // Extrai o DNS atual da URL
  const extractDnsFromUrl = (url) => {
    if (!url) return null;
    try {
      const match = url.match(/^(https?:\/\/[^\/]+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  };

  // Substitui o DNS mantendo o resto da URL
  const replaceDnsInUrl = (url, newDnsValue) => {
    if (!url || !newDnsValue) return url;
    try {
      let cleanDns = newDnsValue.trim().replace(/\/+$/, '');
      if (!cleanDns.match(/^https?:\/\//)) {
        cleanDns = 'http://' + cleanDns;
      }
      return url.replace(/^https?:\/\/[^\/]+/, cleanDns);
    } catch (e) {
      return url;
    }
  };

  const currentDns = extractDnsFromUrl(currentUrl);

  const handleSave = async () => {
    if (!currentUrl) {
      setError('Este usuário não possui playlist M3U8 configurada');
      return;
    }

    if (!newDns.trim()) {
      setError('Digite o novo DNS');
      return;
    }

    // Validação do domínio
    const cleanDns = newDns.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?$/;
    
    if (!domainRegex.test(cleanDns)) {
      setError('DNS inválido. Use o formato: servidor.com ou servidor.com:8080');
      return;
    }

    const newUrl = replaceDnsInUrl(currentUrl, newDns);

    setLoading(true);
    try {
      await gerenciaAPI.updateUser(accountId, user.id, {
        serverName: user.server_name,
        macDevice: user.mac_device,
        m3u8List: newUrl,
        expireDate: user.expire_date || user.expire_account,
      });
      
      toast.success(`DNS alterado com sucesso!`);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar DNS');
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="text-cyan-400" size={20} />
              Trocar DNS
            </h3>
            <p className="text-sm text-text-muted mt-1">{user.server_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!currentUrl ? (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <p className="text-text-muted">Este usuário não possui playlist M3U8 configurada</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">DNS Atual</label>
                <div className="w-full min-h-[44px] bg-bg-tertiary border border-border-color rounded-xl px-4 py-3 flex items-center">
                  <code className="text-cyan-400 text-sm break-all">{currentDns || 'N/A'}</code>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Novo DNS</label>
                <input
                  type="text"
                  value={newDns}
                  onChange={(e) => { setNewDns(e.target.value); setError(''); }}
                  placeholder="Ex: novoservidor.com:8080"
                  className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-400 transition-fast"
                  autoFocus
                />
                {error && (
                  <p className="text-red-400 text-xs mt-1">{error}</p>
                )}
              </div>

              <div className="bg-bg-tertiary rounded-xl p-3">
                <p className="text-xs text-text-muted">
                  💡 <strong>Dica:</strong> O domínio será substituído mantendo o caminho completo da URL (usuário, senha, etc.)
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast"
            >
              Cancelar
            </button>
            {currentUrl && (
              <button 
                type="button"
                onClick={handleSave}
                disabled={loading || !newDns.trim()}
                className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> Salvar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
