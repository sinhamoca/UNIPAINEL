// pages/gerencia/CreateUser.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gerenciaAPI, playlistAPI } from '../../services/api';
import { 
  UserPlus, 
  Loader2, 
  ArrowLeft,
  Check,
  AlertCircle,
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GerenciaCreateUser() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    serverName: '',
    macDevice: '',
    m3u8List: '',
    whatsapp: '',
    expireDays: 30,
  });
  
  const [scanningImage, setScanningImage] = useState(false);

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

  // Carregar contas
  useEffect(() => {
    loadAccounts();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAccount) {
      toast.error('Selecione uma conta');
      return;
    }

    if (!form.serverName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);

    try {
      const response = await gerenciaAPI.createUser(selectedAccount.id, {
        serverName: form.serverName.trim(),
        macDevice: form.macDevice.trim() || '00:00:00:00:00:00',
        m3u8List: form.m3u8List.trim(),
        whatsapp: form.whatsapp.trim(),
        expireDays: parseInt(form.expireDays) || 30,
      });

      if (response.data.success) {
        toast.success('Usuário criado com sucesso!');
        navigate('/gerencia');
      } else {
        toast.error(response.data.error || 'Erro ao criar usuário');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Erro ao criar usuário';
      toast.error(errorMsg);
      
      // Mostrar erros de validação
      if (error.response?.data?.errors) {
        console.error('Validation errors:', error.response.data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMacFormat = (value) => {
    // Formatar MAC automaticamente
    let cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 12; i++) {
      if (i > 0 && i % 2 === 0) formatted += ':';
      formatted += cleaned[i];
    }
    setForm({ ...form, macDevice: formatted });
  };

  const expirePresets = [
    { label: '7 dias', value: 7 },
    { label: '15 dias', value: 15 },
    { label: '30 dias', value: 30 },
    { label: '60 dias', value: 60 },
    { label: '90 dias', value: 90 },
    { label: '180 dias', value: 180 },
    { label: '1 ano', value: 365 },
  ];

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

  const isConnected = selectedAccount?.session_valid_until && 
                      new Date(selectedAccount.session_valid_until) > new Date();

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/gerencia')}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ibo-glow rounded-xl flex items-center justify-center">
            <UserPlus className="text-ibo-primary" size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Criar Usuário</h1>
            <p className="text-text-muted text-xs">IBO Revenda</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Seletor de conta */}
        <div className="bg-bg-card border border-border-color rounded-xl p-4 mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Conta
          </label>
          <select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const acc = accounts.find(a => a.id === parseInt(e.target.value));
              setSelectedAccount(acc);
            }}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary focus:border-ibo-primary transition-fast"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          
          {/* Status da conexão */}
          <div className="mt-2 flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                <span className="text-xs text-emerald-400">Conectado</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                <span className="text-xs text-amber-400">Desconectado</span>
              </>
            )}
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-bg-card border border-border-color rounded-xl p-4">
          {/* Botão de Scan de Imagem */}
          <div className="mb-5">
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all cursor-pointer text-sm">
              {scanningImage ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Camera size={16} />
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
            <p className="text-xs text-text-muted text-center mt-1">
              Envie uma foto para extrair o MAC
            </p>
          </div>

          <div className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Nome do Usuário <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.serverName}
                onChange={(e) => setForm({ ...form, serverName: e.target.value })}
                placeholder="Ex: João Silva"
                className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
                required
              />
            </div>

            {/* MAC Address */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                MAC Address
              </label>
              <input
                type="text"
                value={form.macDevice}
                onChange={(e) => handleMacFormat(e.target.value)}
                placeholder="00:00:00:00:00:00"
                className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary font-mono focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              />
              <p className="text-xs text-text-muted mt-1">
                Deixe vazio para usar MAC padrão
              </p>
            </div>

            {/* Playlist M3U8 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Playlist M3U8
              </label>
              <input
                type="text"
                value={form.m3u8List}
                onChange={(e) => setForm({ ...form, m3u8List: e.target.value })}
                placeholder="http://servidor.com/playlist.m3u8"
                className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary font-mono focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                WhatsApp
              </label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="Ex: 5511999999999"
                className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
              />
            </div>

            {/* Validade */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Validade
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {expirePresets.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setForm({ ...form, expireDays: preset.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-fast ${
                      form.expireDays === preset.value
                        ? 'bg-ibo-primary text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={form.expireDays}
                  onChange={(e) => setForm({ ...form, expireDays: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-24 h-11 bg-bg-tertiary border border-border-color rounded-xl px-3 text-sm text-text-primary text-center font-semibold focus:border-ibo-primary transition-fast"
                />
                <span className="text-text-muted text-sm">dias</span>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={() => navigate('/gerencia')}
              className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !isConnected}
              className="flex-1 h-11 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Criar
                </>
              )}
            </button>
          </div>

          {!isConnected && (
            <p className="text-center text-amber-400 text-xs mt-3">
              ⚠️ Conecte-se à conta primeiro
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
