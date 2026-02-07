// pages/koffice/Accounts.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { kofficeAPI } from '../../services/api';
import { 
  Server, 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  Plug, 
  PlugZap,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Users,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function KofficeAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await kofficeAPI.getAccounts();
      if (response.data.success) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      toast.error('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (account) => {
    setConnecting(account.id);
    const toastId = toast.loading('Conectando... (pode levar até 2 min se tiver captcha)');
    
    try {
      const response = await kofficeAPI.connect(account.id);
      if (response.data.success) {
        toast.success('Conectado com sucesso!', { id: toastId });
        loadAccounts();
      } else {
        toast.error(response.data.error || 'Falha ao conectar', { id: toastId });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao conectar', { id: toastId });
    } finally {
      setConnecting(null);
    }
  };

  const handleDelete = async (account) => {
    if (!confirm(`Excluir conta "${account.name}"?`)) return;
    
    try {
      await kofficeAPI.deleteAccount(account.id);
      toast.success('Conta removida');
      loadAccounts();
    } catch (error) {
      toast.error('Erro ao remover conta');
    }
  };

  const isConnected = (account) => {
    return account.session_valid_until && new Date(account.session_valid_until) > new Date();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
            <Server className="text-cyan-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Contas Koffice</h1>
            <p className="text-text-muted text-xs sm:text-sm">Gerencie suas contas</p>
          </div>
        </div>

        <button
          onClick={() => { setEditingAccount(null); setShowModal(true); }}
          className="h-10 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={18} />
          Nova Conta
        </button>
      </div>

      {/* Lista de Contas */}
      {accounts.length === 0 ? (
        <div className="bg-bg-card border border-border-color rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma conta configurada</h3>
          <p className="text-text-muted mb-6 text-sm">
            Adicione uma conta do painel Koffice para começar
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast"
          >
            <Plus size={18} />
            Adicionar Conta
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map(account => (
            <div key={account.id} className="bg-bg-card border border-border-color rounded-xl p-4 hover:border-border-light transition-fast">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isConnected(account) ? 'bg-emerald-500/10' : 'bg-bg-tertiary'
                  }`}>
                    {isConnected(account) ? (
                      <PlugZap className="text-emerald-400" size={20} />
                    ) : (
                      <Plug className="text-text-muted" size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      {account.name}
                      {account.has_captcha ? (
                        <Shield className="text-amber-400" size={14} title="Requer Captcha" />
                      ) : null}
                    </h3>
                    <p className="text-xs text-text-muted truncate">{account.domain}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  {/* Status */}
                  <div className="text-left sm:text-right">
                    {isConnected(account) ? (
                      <span className="text-emerald-400 text-xs font-medium">🟢 Conectado</span>
                    ) : (
                      <span className="text-text-muted text-xs">🔴 Desconectado</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleConnect(account)}
                      disabled={connecting === account.id}
                      className={`h-9 px-3 rounded-lg text-xs font-medium transition-fast flex items-center gap-1.5 ${
                        isConnected(account)
                          ? 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                          : 'bg-cyan-500 text-white hover:bg-cyan-600'
                      }`}
                    >
                      {connecting === account.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plug size={14} />
                      )}
                      <span className="hidden sm:inline">{isConnected(account) ? 'Reconectar' : 'Conectar'}</span>
                    </button>
                    
                    <button
                      onClick={() => { setEditingAccount(account); setShowModal(true); }}
                      className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-fast"
                    >
                      <Edit size={16} />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(account)}
                      className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Botões de navegação - somente se conectado */}
              {isConnected(account) && (
                <div className="mt-4 pt-4 border-t border-border-color flex gap-3">
                  <button
                    onClick={() => navigate(`/koffice/${account.id}/clients`)}
                    className="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg transition-fast flex items-center justify-center gap-2"
                  >
                    <Users size={18} className="text-cyan-500" />
                    Clientes
                  </button>
                  <button
                    onClick={() => navigate(`/koffice/${account.id}/resellers`)}
                    className="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg transition-fast flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} className="text-orange-500" />
                    Revendas
                  </button>
                </div>
              )}
            </div>
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

function AccountModal({ account, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: account?.name || '',
    domain: account?.domain || '',
    username: account?.username || '',
    password: account ? '' : '', // Não preencher senha ao editar
    hasCaptcha: account?.has_captcha || false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (account) {
        // Editar
        const payload = {
          name: form.name,
          domain: form.domain,
          username: form.username,
          hasCaptcha: form.hasCaptcha,
        };
        if (form.password) {
          payload.password = form.password;
        }
        await kofficeAPI.updateAccount(account.id, payload);
        toast.success('Conta atualizada');
      } else {
        // Criar
        await kofficeAPI.createAccount(form);
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
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">
            {account ? 'Editar Conta' : 'Nova Conta Koffice'}
          </h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Nome da Conta</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Painel Principal"
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-500 transition-fast"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Domínio do Painel</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="Ex: painel.exemplo.com"
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-500 transition-fast"
              required
            />
            <p className="text-xs text-text-muted mt-1">Sem http:// ou https://</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Usuário</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Seu username do painel"
              className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-500 transition-fast"
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
                placeholder={account ? '••••••••' : 'Sua senha do painel'}
                className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 pr-12 text-text-primary focus:border-cyan-500 transition-fast"
                required={!account}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-xl">
            <input
              type="checkbox"
              id="hasCaptcha"
              checked={form.hasCaptcha}
              onChange={(e) => setForm({ ...form, hasCaptcha: e.target.checked })}
              className="w-5 h-5 rounded border-border-color text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="hasCaptcha" className="flex-1">
              <span className="font-medium">Este painel tem hCaptcha</span>
              <p className="text-xs text-text-muted">Requer API do Anti-Captcha configurada no servidor</p>
            </label>
            <Shield className="text-amber-400" size={20} />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
