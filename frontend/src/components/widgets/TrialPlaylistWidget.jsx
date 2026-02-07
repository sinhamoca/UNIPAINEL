// components/widgets/TrialPlaylistWidget.jsx
// Widget de Workflow: Criar Teste → Playlist Manager

import { useState, useEffect, useRef } from 'react';
import { 
  Zap, Settings, Play, Tv, Monitor, Users, ArrowRight, Check, 
  Loader2, X, ChevronDown, ChevronUp, Camera, RefreshCw,
  Save, Clock, Package, Server, FileText, Smartphone
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function TrialPlaylistWidget() {
  // Estado de expansão e modo
  const [expanded, setExpanded] = useState(false);
  const [configMode, setConfigMode] = useState(false);
  
  // Configuração salva
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Contas disponíveis
  const [kofficeAccounts, setKofficeAccounts] = useState([]);
  const [sigmaAccounts, setSigmaAccounts] = useState([]);
  const [uniplayAccounts, setUniplayAccounts] = useState([]);
  
  // Para Sigma: servers e packages
  const [sigmaServers, setSigmaServers] = useState([]);
  const [sigmaPackages, setSigmaPackages] = useState([]);
  const [loadingSigmaPackages, setLoadingSigmaPackages] = useState(false);
  
  // Domínios do Playlist Manager
  const [domains, setDomains] = useState([]);
  
  // Form de configuração
  const [configForm, setConfigForm] = useState({
    koffice_account_id: '',
    sigma_account_id: '',
    uniplay_account_id: '',
    sigma_server_id: '',
    sigma_package_id: '',
    uniplay_hours: 3,
    default_test_name: 'TESTE'
  });
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Estado de execução
  const [selectedSource, setSelectedSource] = useState(null); // 'koffice', 'sigma', 'uniplay'
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  
  // Form do Playlist Manager
  const [playlistForm, setPlaylistForm] = useState({
    player_type: 'iboplayer',
    mac_address: '',
    device_key: '',
    password: '',
    domain: ''
  });
  
  // OCR
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);
  
  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);
  
  // Quando mudar conta Sigma na config, carregar pacotes
  useEffect(() => {
    if (configForm.sigma_account_id) {
      loadSigmaPackages(configForm.sigma_account_id);
    }
  }, [configForm.sigma_account_id]);
  
  const loadInitialData = async () => {
    setLoadingConfig(true);
    try {
      const [configRes, kofficeRes, sigmaRes, uniplayRes, domainsRes] = await Promise.all([
        api.get('/workflow/trial-playlist/config').catch(() => ({ data: { config: null } })),
        api.get('/koffice/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/sigma/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/uniplay/accounts').catch(() => ({ data: { accounts: [] } })),
        api.get('/playlist/domains').catch(() => ({ data: { domains: [] } }))
      ]);
      
      setConfig(configRes.data.config);
      setKofficeAccounts(kofficeRes.data.accounts || []);
      setSigmaAccounts(sigmaRes.data.accounts || []);
      setUniplayAccounts(uniplayRes.data.accounts || []);
      setDomains(domainsRes.data.domains || []);
      
      // Preencher form com config existente
      if (configRes.data.config) {
        const c = configRes.data.config;
        setConfigForm({
          koffice_account_id: c.koffice_account_id || '',
          sigma_account_id: c.sigma_account_id || '',
          uniplay_account_id: c.uniplay_account_id || '',
          sigma_server_id: c.sigma_server_id || '',
          sigma_package_id: c.sigma_package_id || '',
          uniplay_hours: c.uniplay_hours || 3,
          default_test_name: c.default_test_name || 'TESTE'
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingConfig(false);
    }
  };
  
  const loadSigmaPackages = async (accountId) => {
    if (!accountId) return;
    setLoadingSigmaPackages(true);
    try {
      const res = await api.get(`/sigma/accounts/${accountId}/packages`);
      setSigmaServers(res.data.servers || []);
      setSigmaPackages(res.data.packages || []);
    } catch (err) {
      console.error('Erro ao carregar pacotes Sigma:', err);
    } finally {
      setLoadingSigmaPackages(false);
    }
  };
  
  // Salvar configuração
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await api.put('/workflow/trial-playlist/config', configForm);
      if (res.data.success) {
        setConfig(res.data.config);
        toast.success('Configuração salva!');
        setConfigMode(false);
      }
    } catch (err) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };
  
  // OCR - Escanear imagem
  const handleScanImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setScanning(true);
    try {
      // Converter para base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const res = await api.post('/playlist/scan-image', { image: base64 });
      
      if (res.data.success) {
        if (res.data.mac) {
          setPlaylistForm(f => ({ ...f, mac_address: res.data.mac }));
        }
        if (res.data.key) {
          // Preenche device_key E password (IBOPro usa password)
          setPlaylistForm(f => ({ 
            ...f, 
            device_key: res.data.key,
            password: res.data.key 
          }));
        }
        toast.success('Dados extraídos com sucesso!');
      } else {
        toast.error(res.data.error || 'Não foi possível extrair dados');
      }
    } catch (err) {
      toast.error('Erro ao processar imagem');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  // Executar workflow
  const handleExecute = async () => {
    if (!selectedSource) {
      toast.error('Selecione a origem do teste');
      return;
    }
    
    if (!playlistForm.mac_address) {
      toast.error('MAC Address é obrigatório');
      return;
    }
    
    // Validar campos por tipo de player
    if (playlistForm.player_type === 'iboplayer' && (!playlistForm.device_key || !playlistForm.domain)) {
      toast.error('IBOPlayer requer Device Key e Domínio');
      return;
    }
    
    if (playlistForm.player_type === 'ibopro' && !playlistForm.password) {
      toast.error('IBOPro requer Senha');
      return;
    }
    
    if (playlistForm.player_type === 'vuplayer' && !playlistForm.device_key) {
      toast.error('VUPlayer requer Device Key');
      return;
    }
    
    setExecuting(true);
    const toastId = toast.loading('Executando workflow...');
    
    try {
      // PASSO 1: Criar teste na origem
      toast.loading('Criando teste...', { id: toastId });
      let m3uUrl = null;
      let testInfo = null;
      
      if (selectedSource === 'koffice') {
        const res = await api.post(`/koffice/accounts/${config.koffice_account_id}/test`);
        if (!res.data.success) throw new Error(res.data.error || 'Erro ao criar teste Koffice');
        
        // Extrair M3U - ordem de prioridade
        // 1. Campo direto m3uUrl (já parseado pelo backend)
        // 2. Parse do rawMessage com regex TS (mesmo do workflow que funciona)
        // 3. shortUrl como último fallback
        m3uUrl = res.data.m3uUrl || res.data.m3u_url || null;
        
        // Se não veio m3uUrl, fazer parse do rawMessage ANTES de usar shortUrl
        if (!m3uUrl && res.data.rawMessage) {
          // Tentar encontrar URL M3U na mensagem
          // Padrões ordenados por prioridade (TS é o mesmo do workflow Koffice→IBO)
          const patterns = [
            /TS\s*-?\s*(https?:\/\/[^\s\*<\n]+)/i,  // ← MESMO REGEX do workflow que funciona!
            /M3U[:\s]+\*?(https?:\/\/[^\s\*<]+)/i,
            /Link M3U[:\s]+\*?(https?:\/\/[^\s\*<]+)/i,
            /(https?:\/\/[^\s<]+get\.php[^\s<]*)/i,
            /(https?:\/\/[^\s<]+\.m3u8?[^\s<]*)/i,
            /(https?:\/\/[^\s<]+type=m3u[^\s<]*)/i
          ];
          
          for (const pattern of patterns) {
            const match = res.data.rawMessage.match(pattern);
            if (match) {
              m3uUrl = match[1].trim();
              break;
            }
          }
        }
        
        // Último fallback: shortUrl
        if (!m3uUrl) {
          m3uUrl = res.data.shortUrl || res.data.short_url || null;
        }
        
        testInfo = { user: res.data.user, password: res.data.password };
        console.log('Koffice test response:', { m3uUrl, user: res.data.user });
      } 
      else if (selectedSource === 'sigma') {
        // NÃO enviar trial_hours - deixar o Sigma usar o padrão do pacote
        const res = await api.post(`/sigma/accounts/${config.sigma_account_id}/customers/trial`, {
          server_id: config.sigma_server_id,
          package_id: config.sigma_package_id,
          connections: 1
          // trial_hours é definido pelo pacote, não enviar
        });
        if (!res.data.success) throw new Error(res.data.error || 'Erro ao criar teste Sigma');
        // O M3U pode vir em diferentes lugares
        m3uUrl = res.data.playlist?.m3u_url || 
                 res.data.customer?.m3u_url || 
                 res.data.customer?.m3u_url_short ||
                 res.data.m3u_url;
        testInfo = res.data.customer;
      }
      else if (selectedSource === 'uniplay') {
        const res = await api.post(`/uniplay/accounts/${config.uniplay_account_id}/trial`, {
          hours: config.uniplay_hours
        });
        if (!res.data.success) throw new Error(res.data.error || 'Erro ao criar teste Uniplay');
        m3uUrl = res.data.trial?.m3u8 || res.data.trial?.m3u8Short;
        testInfo = res.data.trial;
      }
      
      if (!m3uUrl) {
        throw new Error('Não foi possível obter URL M3U do teste');
      }
      
      // PASSO 2: Criar cliente no Playlist Manager (ou usar existente)
      toast.loading('Configurando cliente no Playlist Manager...', { id: toastId });
      
      let clientId = null;
      let clientData = null;
      let clientExisted = false;
      
      try {
        const clientRes = await api.post('/playlist/clients', {
          name: config.default_test_name,
          player_type: playlistForm.player_type,
          mac_address: playlistForm.mac_address,
          device_key: playlistForm.device_key || null,
          password: playlistForm.password || null,
          domain: playlistForm.domain || null
        });
        
        if (clientRes.data.success) {
          // Cliente criado com sucesso
          clientId = clientRes.data.client?.id;
          clientData = clientRes.data.client;
        } else {
          throw new Error(clientRes.data.error || 'Erro ao criar cliente');
        }
      } catch (clientErr) {
        // Verificar se é erro de MAC já cadastrado (axios lança exceção em status 400)
        const errorMsg = clientErr.response?.data?.error || clientErr.message;
        
        if (errorMsg === 'MAC Address já cadastrado') {
          // Cliente já existe - buscar pelo MAC
          const searchRes = await api.get(`/playlist/clients/search?q=${encodeURIComponent(playlistForm.mac_address)}`);
          const existingClient = searchRes.data.clients?.find(c => c.mac_address === playlistForm.mac_address);
          
          if (existingClient) {
            clientId = existingClient.id;
            clientData = existingClient;
            clientExisted = true;
          } else {
            throw new Error('MAC já cadastrado mas cliente não encontrado');
          }
        } else {
          throw new Error(errorMsg || 'Erro ao criar cliente');
        }
      }
      
      // PASSO 3: Adicionar playlist ao cliente
      toast.loading('Adicionando playlist...', { id: toastId });
      
      const playlistRes = await api.post(`/playlist/clients/${clientId}/playlists`, {
        name: config.default_test_name,
        url: m3uUrl,
        type: 'general'
      });
      
      if (!playlistRes.data.success) {
        throw new Error(playlistRes.data.error || 'Erro ao adicionar playlist');
      }
      
      // Sucesso!
      if (clientExisted) {
        toast.success('Playlist adicionada ao cliente existente!', { id: toastId });
      } else {
        toast.success('Workflow executado com sucesso!', { id: toastId });
      }
      
      setResult({
        success: true,
        source: selectedSource,
        testInfo,
        m3uUrl,
        client: clientData,
        clientExisted,
        playlist: playlistRes.data.playlist
      });
      
    } catch (err) {
      toast.error(err.message || 'Erro ao executar workflow', { id: toastId });
    } finally {
      setExecuting(false);
    }
  };
  
  // Reset para nova execução
  const handleReset = () => {
    setSelectedSource(null);
    setPlaylistForm({
      player_type: 'iboplayer',
      mac_address: '',
      device_key: '',
      password: '',
      domain: ''
    });
    setResult(null);
  };
  
  // Verificar se está configurado
  const isConfigured = config && (
    config.koffice_account_id || 
    (config.sigma_account_id && config.sigma_server_id && config.sigma_package_id) || 
    config.uniplay_account_id
  );
  
  // Verificar quais fontes estão disponíveis
  const availableSources = {
    koffice: config?.koffice_account_id,
    sigma: config?.sigma_account_id && config?.sigma_server_id && config?.sigma_package_id,
    uniplay: config?.uniplay_account_id
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-amber-500" />
            </div>
            <ArrowRight size={14} className="text-text-muted" />
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Tv size={18} className="text-purple-500" />
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-text-primary">Teste → Playlist Manager</h3>
            <p className="text-xs text-text-muted">Criar teste e adicionar ao player</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfigMode(!configMode); }}
              className={`p-2 rounded-lg transition-colors ${configMode ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/10 text-text-muted'}`}
            >
              <Settings size={18} />
            </button>
          )}
          {expanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
        </div>
      </button>
      
      {/* Conteúdo expandido */}
      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : configMode ? (
            /* ========== MODO CONFIGURAÇÃO ========== */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Settings size={16} />
                <span className="font-semibold">Configuração do Workflow</span>
              </div>
              
              {/* Nome padrão */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  <FileText size={12} className="inline mr-1" />
                  Nome Padrão de Teste
                </label>
                <input
                  type="text"
                  value={configForm.default_test_name}
                  onChange={(e) => setConfigForm(f => ({ ...f, default_test_name: e.target.value }))}
                  placeholder="Ex: TESTE"
                  className="w-full h-10 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                />
              </div>
              
              {/* Seção Koffice */}
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                  <Monitor size={14} />
                  Koffice
                </div>
                <select
                  value={configForm.koffice_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, koffice_account_id: e.target.value }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Selecione conta...</option>
                  {kofficeAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <p className="text-xs text-text-muted">Teste padrão (sem configuração extra)</p>
              </div>
              
              {/* Seção Sigma */}
              <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <Server size={14} />
                  Sigma
                </div>
                <select
                  value={configForm.sigma_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, sigma_account_id: e.target.value, sigma_server_id: '', sigma_package_id: '' }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Selecione conta...</option>
                  {sigmaAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                
                {configForm.sigma_account_id && (
                  <>
                    {loadingSigmaPackages ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Loader2 size={12} className="animate-spin" />
                        Carregando pacotes...
                      </div>
                    ) : (
                      <>
                        <select
                          value={configForm.sigma_server_id}
                          onChange={(e) => setConfigForm(f => ({ ...f, sigma_server_id: e.target.value }))}
                          className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                        >
                          <option value="">Servidor...</option>
                          {sigmaServers.map(srv => (
                            <option key={srv.id} value={srv.id}>{srv.name}</option>
                          ))}
                        </select>
                        <select
                          value={configForm.sigma_package_id}
                          onChange={(e) => setConfigForm(f => ({ ...f, sigma_package_id: e.target.value }))}
                          className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                        >
                          <option value="">Pacote de teste...</option>
                          {sigmaPackages.filter(p => p.is_trial || p.trial).map(pkg => (
                            <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}
              </div>
              
              {/* Seção Uniplay */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                  <Play size={14} />
                  Uniplay
                </div>
                <select
                  value={configForm.uniplay_account_id}
                  onChange={(e) => setConfigForm(f => ({ ...f, uniplay_account_id: e.target.value }))}
                  className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                >
                  <option value="">Selecione conta...</option>
                  {uniplayAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                
                {configForm.uniplay_account_id && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      <Clock size={10} className="inline mr-1" />
                      Tempo de teste
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 6].map(h => (
                        <button
                          key={h}
                          onClick={() => setConfigForm(f => ({ ...f, uniplay_hours: h }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            configForm.uniplay_hours === h 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-bg-tertiary text-text-muted hover:bg-blue-500/20'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Botão Salvar */}
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingConfig ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Salvar Configuração
              </button>
            </div>
          ) : !isConfigured ? (
            /* ========== NÃO CONFIGURADO ========== */
            <div className="text-center py-6">
              <Settings size={40} className="mx-auto text-amber-500/50 mb-3" />
              <p className="text-text-muted mb-3">Configure o workflow primeiro</p>
              <button
                onClick={() => setConfigMode(true)}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
              >
                Configurar
              </button>
            </div>
          ) : result ? (
            /* ========== RESULTADO ========== */
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Check size={20} className="text-emerald-500" />
                <span className="font-semibold text-emerald-400">Workflow Concluído!</span>
              </div>
              <div className="space-y-1 text-sm text-text-secondary">
                <p>✅ Teste criado via <strong className="text-text-primary">{result.source}</strong></p>
                {result.clientExisted ? (
                  <p>ℹ️ Cliente já existia: <strong className="text-amber-400">{result.client?.name || result.client?.mac_address}</strong></p>
                ) : (
                  <p>✅ Cliente criado: <strong className="text-text-primary">{result.client?.name}</strong></p>
                )}
                <p>✅ Playlist adicionada</p>
              </div>
              <button
                onClick={handleReset}
                className="mt-4 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
              >
                Nova Execução
              </button>
            </div>
          ) : (
            /* ========== MODO EXECUÇÃO ========== */
            <div className="space-y-4">
              {/* Seleção de Origem */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">
                  Origem do Teste
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Koffice */}
                  <button
                    onClick={() => availableSources.koffice && setSelectedSource('koffice')}
                    disabled={!availableSources.koffice}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedSource === 'koffice'
                        ? 'border-cyan-500 bg-cyan-500/20'
                        : availableSources.koffice
                          ? 'border-border-color hover:border-cyan-500/50 bg-bg-tertiary'
                          : 'border-border-color bg-bg-tertiary opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Monitor size={20} className={`mx-auto mb-1 ${selectedSource === 'koffice' ? 'text-cyan-400' : 'text-text-muted'}`} />
                    <p className={`text-xs font-medium ${selectedSource === 'koffice' ? 'text-cyan-400' : 'text-text-muted'}`}>Koffice</p>
                  </button>
                  
                  {/* Sigma */}
                  <button
                    onClick={() => availableSources.sigma && setSelectedSource('sigma')}
                    disabled={!availableSources.sigma}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedSource === 'sigma'
                        ? 'border-violet-500 bg-violet-500/20'
                        : availableSources.sigma
                          ? 'border-border-color hover:border-violet-500/50 bg-bg-tertiary'
                          : 'border-border-color bg-bg-tertiary opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Server size={20} className={`mx-auto mb-1 ${selectedSource === 'sigma' ? 'text-violet-400' : 'text-text-muted'}`} />
                    <p className={`text-xs font-medium ${selectedSource === 'sigma' ? 'text-violet-400' : 'text-text-muted'}`}>Sigma</p>
                  </button>
                  
                  {/* Uniplay */}
                  <button
                    onClick={() => availableSources.uniplay && setSelectedSource('uniplay')}
                    disabled={!availableSources.uniplay}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedSource === 'uniplay'
                        ? 'border-blue-500 bg-blue-500/20'
                        : availableSources.uniplay
                          ? 'border-border-color hover:border-blue-500/50 bg-bg-tertiary'
                          : 'border-border-color bg-bg-tertiary opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Play size={20} className={`mx-auto mb-1 ${selectedSource === 'uniplay' ? 'text-blue-400' : 'text-text-muted'}`} />
                    <p className={`text-xs font-medium ${selectedSource === 'uniplay' ? 'text-blue-400' : 'text-text-muted'}`}>Uniplay</p>
                  </button>
                </div>
              </div>
              
              {/* Dados do Playlist Manager */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-400 flex items-center gap-2">
                    <Tv size={14} />
                    Dados do Player
                  </span>
                  
                  {/* Botão OCR */}
                  <label className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs cursor-pointer hover:bg-purple-500/30 transition-colors">
                    {scanning ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    Escanear
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleScanImage}
                      className="hidden"
                    />
                  </label>
                </div>
                
                {/* Tipo de Player */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo de Player</label>
                  <select
                    value={playlistForm.player_type}
                    onChange={(e) => setPlaylistForm(f => ({ ...f, player_type: e.target.value }))}
                    className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                  >
                    <option value="iboplayer">IBOPlayer</option>
                    <option value="ibopro">IBOPro</option>
                    <option value="vuplayer">VUPlayer</option>
                  </select>
                </div>
                
                {/* MAC Address */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">MAC Address *</label>
                  <input
                    type="text"
                    value={playlistForm.mac_address}
                    onChange={(e) => setPlaylistForm(f => ({ ...f, mac_address: e.target.value }))}
                    placeholder="00:1A:79:XX:XX:XX"
                    className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                  />
                </div>
                
                {/* Device Key - para IBOPlayer e VUPlayer */}
                {(playlistForm.player_type === 'iboplayer' || playlistForm.player_type === 'vuplayer') && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      Device Key {playlistForm.player_type === 'iboplayer' ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      value={playlistForm.device_key}
                      onChange={(e) => setPlaylistForm(f => ({ ...f, device_key: e.target.value }))}
                      placeholder="XXXX-XXXX-XXXX"
                      className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                    />
                  </div>
                )}
                
                {/* Senha - para IBOPro */}
                {playlistForm.player_type === 'ibopro' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Senha *</label>
                    <input
                      type="text"
                      value={playlistForm.password}
                      onChange={(e) => setPlaylistForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Senha do dispositivo"
                      className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                    />
                  </div>
                )}
                
                {/* Domínio - para IBOPlayer */}
                {playlistForm.player_type === 'iboplayer' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Domínio *</label>
                    <select
                      value={playlistForm.domain}
                      onChange={(e) => setPlaylistForm(f => ({ ...f, domain: e.target.value }))}
                      className="w-full h-9 bg-bg-tertiary border border-border-color rounded-lg px-3 text-sm text-text-primary"
                    >
                      <option value="">Selecione...</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.domain}>{d.domain}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Info de configuração */}
              {selectedSource && (
                <div className="text-xs text-text-muted bg-bg-tertiary rounded-lg p-2">
                  {selectedSource === 'koffice' && (
                    <span>Teste padrão será criado no Koffice</span>
                  )}
                  {selectedSource === 'sigma' && (
                    <span>Teste com pacote configurado será criado no Sigma</span>
                  )}
                  {selectedSource === 'uniplay' && (
                    <span>Teste de {config.uniplay_hours}h será criado no Uniplay</span>
                  )}
                </div>
              )}
              
              {/* Botão Executar */}
              <button
                onClick={handleExecute}
                disabled={!selectedSource || !playlistForm.mac_address || executing}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-purple-500 hover:from-amber-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Executar Workflow
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
