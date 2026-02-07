// pages/gerencia/Accounts.jsx
import { useState, useEffect } from 'react';
import { gerenciaAPI } from '../../services/api';
import { 
  Plus, 
  Loader2, 
  Settings, 
  Trash2, 
  Wifi, 
  WifiOff,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GerenciaAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [connectingId, setConnectingId] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await gerenciaAPI.getAccounts();
      if (response.data.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      toast.error('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (accountId) => {
    setConnectingId(accountId);
    try {
      const response = await gerenciaAPI.connect(accountId);
      if (response.data.success) {
        toast.success(response.data.message);
        loadAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao conectar');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (accountId) => {
    try {
      await gerenciaAPI.disconnect(accountId);
      toast.success('Sessão encerrada');
      loadAccounts();
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  const handleDelete = async (accountId) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    
    try {
      await gerenciaAPI.deleteAccount(accountId);
      toast.success('Conta excluída');
      loadAccounts();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const isConnected = (account) => {
    return account.session_valid_until && 
           new Date(account.session_valid_until) > new Date();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-ibo-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
            <span className="w-10 h-10 bg-ibo-glow rounded-xl flex items-center justify-center">
              <Settings className="text-ibo-primary" size={20} />
            </span>
            Contas GerenciaApp
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Configure suas credenciais do painel
          </p>
        </div>
        <button
          onClick={() => { setEditingAccount(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast w-full sm:w-auto"
        >
          <Plus size={18} />
          Nova Conta
        </button>
      </div>

      {/* Lista de Contas */}
      {accounts.length === 0 ? (
        <div className="bg-bg-card border border-border-color rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-ibo-glow rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Settings className="text-ibo-primary" size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma conta configurada</h3>
          <p className="text-text-muted mb-6">
            Adicione sua primeira conta do GerenciaApp para começar
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast"
          >
            <Plus size={20} />
            Adicionar Conta
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isConnected={isConnected(account)}
              connecting={connectingId === account.id}
              onConnect={() => handleConnect(account.id)}
              onDisconnect={() => handleDisconnect(account.id)}
              onEdit={() => { setEditingAccount(account); setShowModal(true); }}
              onDelete={() => handleDelete(account.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => { setShowModal(false); setEditingAccount(null); }}
          onSaved={() => { setShowModal(false); setEditingAccount(null); loadAccounts(); }}
        />
      )}
    </div>
  );
}

function AccountCard({ account, isConnected, connecting, onConnect, onDisconnect, onEdit, onDelete }) {
  return (
    <div className="bg-bg-card border border-border-color rounded-2xl p-4 sm:p-6 hover:border-border-light transition-fast">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isConnected ? 'bg-emerald-500/10' : 'bg-bg-tertiary'
          }`}>
            {isConnected ? (
              <Wifi className="text-emerald-400" size={22} />
            ) : (
              <WifiOff className="text-text-muted" size={22} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate">{account.name}</h3>
            <p className="text-sm text-text-muted truncate">{account.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          {/* Status badge */}
          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
            isConnected 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-bg-tertiary text-text-muted'
          }`}>
            {isConnected ? '🟢 Conectado' : '⚪ Desconectado'}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="p-2 text-text-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-fast"
                title="Desconectar"
              >
                <WifiOff size={18} />
              </button>
            ) : (
              <button
                onClick={onConnect}
                disabled={connecting}
                className="p-2 text-text-muted hover:text-ibo-primary hover:bg-ibo-glow rounded-lg transition-fast disabled:opacity-50"
                title="Conectar"
              >
                {connecting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
              title="Editar"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
              title="Excluir"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {account.last_login_at && (
        <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border-color">
          Último login: {new Date(account.last_login_at).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}

function AccountModal({ account, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: account?.name || '',
    email: account?.email || '',
    password: '',
    baseUrl: account?.base_url || 'https://www.gerenciaapp.top',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (account) {
        // Editar
        const updateData = { name: form.name, email: form.email, baseUrl: form.baseUrl };
        if (form.password) updateData.password = form.password;
        await gerenciaAPI.updateAccount(account.id, updateData);
        toast.success('Conta atualizada');
      } else {
        // Criar
        if (!form.password) {
          toast.error('Senha é obrigatória');
          setLoading(false);
          return;
        }
        await gerenciaAPI.createAccount(form);
        toast.success('Conta criada');
      }
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">
            {account ? 'Editar Conta' : 'Nova Conta'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Nome da Conta
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              placeholder="Ex: Conta Principal"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email do GerenciaApp
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Senha {account && <span className="text-text-muted">(deixe vazio para manter)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 pr-12 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
                placeholder="••••••••"
                required={!account}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-fast"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              URL do Painel
            </label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary font-mono text-sm focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              placeholder="https://www.gerenciaapp.top"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  {account ? 'Salvar' : 'Criar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
