// pages/playlist/Clients.jsx - Gerenciamento de Clientes do Playlist Manager
import { useState, useEffect, useCallback } from 'react';
import { playlistAPI } from '../../services/api';
import { 
  Users, Plus, Search, Trash2, List, Globe, X, Loader2, 
  Tv, Lock, Unlock, RefreshCw, Edit, ArrowRightLeft, Server, Zap, Check, Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlaylistClients() {
  // Estados principais
  const [clients, setClients] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados de modais
  const [showAddClient, setShowAddClient] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showPlaylists, setShowPlaylists] = useState(false);
  
  // Estado do formulário de cliente
  const [clientForm, setClientForm] = useState({
    name: '',
    player_type: 'iboplayer',
    mac_address: '',
    device_key: '',
    password: '',
    domain: '',
    notes: '',
    server_id: ''
  });
  const [savingClient, setSavingClient] = useState(false);
  
  // Estado do formulário de domínio
  const [domainForm, setDomainForm] = useState({
    domain: '',
    description: ''
  });
  const [savingDomain, setSavingDomain] = useState(false);
  
  // Estado de playlists
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  // Modal: Adicionar Playlist
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    url: '',
    type: 'general',
    protect: false,
    pin: ''
  });
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  
  // Modal: Editar Playlist
  const [showEditPlaylist, setShowEditPlaylist] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    type: 'general',
    protect: false,
    pin: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Modal: Trocar DNS
  const [showChangeDns, setShowChangeDns] = useState(false);
  const [changingPlaylist, setChangingPlaylist] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [savingDns, setSavingDns] = useState(false);
  
  // Modal: Editar Cliente
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editClientForm, setEditClientForm] = useState({
    name: '',
    player_type: 'iboplayer',
    mac_address: '',
    device_key: '',
    password: '',
    domain: '',
    notes: '',
    server_id: ''
  });
  const [savingEditClient, setSavingEditClient] = useState(false);
  
  // Estados: Servidores (Tags)
  const [servers, setServers] = useState([]);
  const [showServers, setShowServers] = useState(false);
  const [serverForm, setServerForm] = useState({
    name: '',
    color: '🔵',
    description: ''
  });
  const [savingServer, setSavingServer] = useState(false);
  
  // Estados: Troca DNS em Massa
  const [showBulkDns, setShowBulkDns] = useState(false);
  const [bulkDnsForm, setBulkDnsForm] = useState({
    mode: 'all',
    server_id: '',
    client_ids: [],
    old_domain: '',
    new_domain: ''
  });
  const [bulkDnsStep, setBulkDnsStep] = useState(1); // 1: seleção, 2: configuração, 3: execução
  const [executingBulkDns, setExecutingBulkDns] = useState(false);
  const [bulkDnsResults, setBulkDnsResults] = useState(null);
  const [selectedClientsForBulk, setSelectedClientsForBulk] = useState([]);
  
  // Cores disponíveis para servidores
  const serverColors = ['🔵', '🟢', '🔴', '🟡', '🟠', '🟣', '⚪', '🟤'];
  
  // Estado: OCR Scanning
  const [scanningImage, setScanningImage] = useState(false);
  
  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientsRes, domainsRes, serversRes] = await Promise.all([
        playlistAPI.getClients(),
        playlistAPI.getDomains(),
        playlistAPI.getServers()
      ]);
      setClients(clientsRes.data.clients || []);
      setDomains(domainsRes.data.domains || []);
      setServers(serversRes.data.servers || []);
    } catch (err) {
      toast.error('Erro ao carregar dados: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Buscar clientes
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      loadData();
      return;
    }
    
    try {
      const res = await playlistAPI.searchClients(query);
      setClients(res.data.clients || []);
    } catch (err) {
      console.error('Erro na busca:', err);
    }
  };
  
  // Criar cliente
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setSavingClient(true);
    try {
      await playlistAPI.createClient(clientForm);
      toast.success('Cliente criado com sucesso!');
      setShowAddClient(false);
      setClientForm({
        name: '',
        player_type: 'iboplayer',
        mac_address: '',
        device_key: '',
        password: '',
        domain: '',
        notes: '',
        server_id: ''
      });
      loadData();
    } catch (err) {
      toast.error('Erro ao criar cliente: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingClient(false);
    }
  };
  
  // Deletar cliente
  const handleDeleteClient = async (client) => {
    if (!confirm(`Deseja realmente deletar "${client.name}"?`)) return;
    
    try {
      await playlistAPI.deleteClient(client.id);
      toast.success('Cliente deletado!');
      loadData();
    } catch (err) {
      toast.error('Erro ao deletar: ' + err.message);
    }
  };
  
  // Abrir modal de edição de cliente
  const handleEditClient = (client) => {
    setEditingClient(client);
    setEditClientForm({
      name: client.name || '',
      player_type: client.player_type || 'iboplayer',
      mac_address: client.mac_address || '',
      device_key: client.device_key || '',
      password: client.password || '',
      domain: client.domain || '',
      notes: client.notes || '',
      server_id: client.server_id || ''
    });
    setShowEditClient(true);
  };
  
  // Salvar edição de cliente
  const handleUpdateClient = async (e) => {
    e.preventDefault();
    setSavingEditClient(true);
    
    try {
      await playlistAPI.updateClient(editingClient.id, editClientForm);
      toast.success('Cliente atualizado!');
      setShowEditClient(false);
      setEditingClient(null);
      loadData();
    } catch (err) {
      toast.error('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingEditClient(false);
    }
  };
  
  // Criar domínio
  const handleCreateDomain = async (e) => {
    e.preventDefault();
    setSavingDomain(true);
    try {
      await playlistAPI.createDomain(domainForm);
      toast.success('Domínio adicionado!');
      setDomainForm({ domain: '', description: '' });
      const res = await playlistAPI.getDomains();
      setDomains(res.data.domains || []);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingDomain(false);
    }
  };
  
  // Deletar domínio
  const handleDeleteDomain = async (domain) => {
    if (!confirm(`Deletar "${domain.domain}"?`)) return;
    
    try {
      await playlistAPI.deleteDomain(domain.id);
      toast.success('Domínio removido!');
      const res = await playlistAPI.getDomains();
      setDomains(res.data.domains || []);
    } catch (err) {
      toast.error('Erro: ' + err.message);
    }
  };
  
  // ========================================
  // SERVIDORES (Tags/Grupos)
  // ========================================
  
  // Criar servidor
  const handleCreateServer = async (e) => {
    e.preventDefault();
    setSavingServer(true);
    try {
      await playlistAPI.createServer(serverForm);
      toast.success('Servidor criado!');
      setServerForm({ name: '', color: '🔵', description: '' });
      const res = await playlistAPI.getServers();
      setServers(res.data.servers || []);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingServer(false);
    }
  };
  
  // Deletar servidor
  const handleDeleteServer = async (server) => {
    if (!confirm(`Deletar servidor "${server.name}"? Os clientes não serão deletados.`)) return;
    
    try {
      await playlistAPI.deleteServer(server.id);
      toast.success('Servidor removido!');
      loadData();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    }
  };
  
  // ========================================
  // TROCA DE DNS EM MASSA
  // ========================================
  
  // Abrir modal de troca DNS em massa
  const handleOpenBulkDns = () => {
    setBulkDnsForm({
      mode: 'all',
      server_id: '',
      client_ids: [],
      old_domain: '',
      new_domain: ''
    });
    setBulkDnsStep(1);
    setSelectedClientsForBulk([]);
    setBulkDnsResults(null);
    setShowBulkDns(true);
  };
  
  // Toggle seleção de cliente para bulk DNS
  const toggleClientForBulk = (clientId) => {
    setSelectedClientsForBulk(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };
  
  // Selecionar todos os clientes de um servidor
  const selectAllFromServer = (serverId) => {
    const serverClients = clients.filter(c => c.server_id == serverId).map(c => c.id);
    setSelectedClientsForBulk(serverClients);
  };
  
  // Executar troca DNS em massa
  const handleExecuteBulkDns = async () => {
    if (!bulkDnsForm.new_domain) {
      toast.error('Informe o novo domínio');
      return;
    }
    
    if (bulkDnsForm.mode === 'specific' && !bulkDnsForm.old_domain) {
      toast.error('Informe o domínio antigo');
      return;
    }
    
    if (selectedClientsForBulk.length === 0 && !bulkDnsForm.server_id) {
      toast.error('Selecione clientes ou um servidor');
      return;
    }
    
    setExecutingBulkDns(true);
    setBulkDnsStep(3);
    
    try {
      const res = await playlistAPI.bulkDns({
        client_ids: selectedClientsForBulk,
        server_id: bulkDnsForm.server_id || null,
        mode: bulkDnsForm.mode,
        old_domain: bulkDnsForm.old_domain || null,
        new_domain: bulkDnsForm.new_domain
      });
      
      setBulkDnsResults(res.data.results);
      toast.success(`Troca concluída! ${res.data.results.success} cliente(s) atualizados`);
      loadData();
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
      setBulkDnsResults({ error: err.response?.data?.error || err.message });
    } finally {
      setExecutingBulkDns(false);
    }
  };
  
  // ========================================
  // OCR - ESCANEAR IMAGEM
  // ========================================
  
  // Processar imagem para OCR (usado em adicionar e editar cliente)
  const handleScanImage = async (file, formType = 'add') => {
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    
    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return;
    }
    
    setScanningImage(true);
    
    try {
      // Converter para base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Enviar para OCR
      const res = await playlistAPI.scanImage(base64);
      
      const { mac, key } = res.data;
      
      // Verificar o que foi encontrado
      if (!mac && !key) {
        toast.error('Não foi possível extrair MAC ou Device Key da imagem. Tente outra foto ou preencha manualmente.');
        return;
      }
      
      // Atualizar formulário correspondente
      if (formType === 'add') {
        setClientForm(prev => ({
          ...prev,
          mac_address: mac || prev.mac_address,
          device_key: key || prev.device_key,
          password: key || prev.password // Também preenche password para IBOPro
        }));
      } else {
        setEditClientForm(prev => ({
          ...prev,
          mac_address: mac || prev.mac_address,
          device_key: key || prev.device_key,
          password: key || prev.password // Também preenche password para IBOPro
        }));
      }
      
      // Mostrar feedback
      if (mac && key) {
        toast.success(`✅ Extraído: MAC e Key/Senha`);
      } else if (mac) {
        toast.success(`📱 Extraído: MAC Address\n⚠️ Key/Senha não encontrada`);
      } else if (key) {
        toast.success(`🔑 Extraído: Key/Senha\n⚠️ MAC Address não encontrado`);
      }
      
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
  
  // Ver playlists do cliente
  const handleViewPlaylists = async (client) => {
    setSelectedClient(client);
    setShowPlaylists(true);
    setLoadingPlaylists(true);
    setPlaylists([]);
    
    try {
      const res = await playlistAPI.getPlaylists(client.id);
      setPlaylists(res.data.playlists || []);
    } catch (err) {
      toast.error('Erro ao carregar playlists: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingPlaylists(false);
    }
  };
  
  // Adicionar playlist
  const handleAddPlaylist = async (e) => {
    e.preventDefault();
    setSavingPlaylist(true);
    try {
      await playlistAPI.addPlaylist(selectedClient.id, playlistForm);
      toast.success('Playlist adicionada!');
      setShowAddPlaylist(false);
      setPlaylistForm({ name: '', url: '', type: 'general', protect: false, pin: '' });
      handleViewPlaylists(selectedClient);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingPlaylist(false);
    }
  };
  
  // Abrir modal de edição
  const openEditPlaylist = (playlist) => {
    setEditingPlaylist(playlist);
    setEditForm({
      name: playlist.name || '',
      url: playlist.url || '',
      type: playlist.type || 'general',
      protect: playlist.is_protected || false,
      pin: playlist.pin || ''
    });
    setShowEditPlaylist(true);
  };
  
  // Salvar edição
  const handleEditPlaylist = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await playlistAPI.editPlaylist(selectedClient.id, editingPlaylist.id, editForm);
      toast.success('Playlist atualizada!');
      setShowEditPlaylist(false);
      setEditingPlaylist(null);
      handleViewPlaylists(selectedClient);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingEdit(false);
    }
  };
  
  // Abrir modal de trocar DNS
  const openChangeDns = (playlist) => {
    setChangingPlaylist(playlist);
    setNewDomain('');
    setShowChangeDns(true);
  };
  
  // Trocar DNS
  const handleChangeDns = async (e) => {
    e.preventDefault();
    setSavingDns(true);
    try {
      await playlistAPI.changeDomain(selectedClient.id, changingPlaylist.id, newDomain);
      toast.success('DNS alterado com sucesso!');
      setShowChangeDns(false);
      setChangingPlaylist(null);
      handleViewPlaylists(selectedClient);
    } catch (err) {
      toast.error('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingDns(false);
    }
  };
  
  // Deletar playlist
  const handleDeletePlaylist = async (playlist) => {
    if (!confirm(`Deletar "${playlist.name}"?`)) return;
    
    try {
      await playlistAPI.deletePlaylist(selectedClient.id, playlist.id);
      toast.success('Playlist removida!');
      handleViewPlaylists(selectedClient);
    } catch (err) {
      toast.error('Erro: ' + err.message);
    }
  };
  
  // Extrair domínio de URL
  const extractDomain = (url) => {
    try {
      const match = url.match(/^https?:\/\/([^\/\?]+)/);
      return match ? match[1] : url;
    } catch {
      return url;
    }
  };
  
  // Player badges
  const playerBadge = {
    iboplayer: { label: 'IBOPlayer', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    ibopro: { label: 'IBOPro', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    vuplayer: { label: 'VUPlayer', bg: 'bg-green-500/20', text: 'text-green-400' }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
            <Tv className="text-purple-500" />
            Playlist Manager
          </h1>
          <p className="text-text-secondary text-sm mt-1 hidden sm:block">
            Gerencie playlists de IBOPlayer, IBOPro e VUPlayer
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowDomains(true)}
            className="px-3 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover transition-fast flex items-center gap-1.5 text-sm"
          >
            <Globe size={16} />
            <span className="hidden sm:inline">Domínios</span>
          </button>
          <button
            onClick={() => setShowServers(true)}
            className="px-3 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover transition-fast flex items-center gap-1.5 text-sm"
          >
            <Server size={16} />
            <span className="hidden sm:inline">Servidores</span>
          </button>
          <button
            onClick={handleOpenBulkDns}
            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-fast flex items-center gap-1.5 text-sm"
          >
            <Zap size={16} />
            <span className="hidden sm:inline">Trocar DNS</span>
          </button>
          <button
            onClick={() => setShowAddClient(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-fast flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>
      
      {/* Barra de busca */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-color">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou MAC..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-fast"
          />
        </div>
      </div>
      
      {/* Lista de clientes */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        {clients.length === 0 ? (
          <div className="px-6 py-12 text-center text-text-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-bg-tertiary border-b border-border-color">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Servidor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">MAC</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Sessão</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-bg-hover transition-fast">
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-primary">{client.name}</div>
                        {client.notes && (
                          <div className="text-xs text-text-muted mt-0.5">{client.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs rounded-full ${playerBadge[client.player_type]?.bg} ${playerBadge[client.player_type]?.text}`}>
                          {playerBadge[client.player_type]?.label || client.player_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {client.server_name ? (
                          <span className="text-sm">
                            {client.server_color} {client.server_name}
                          </span>
                        ) : (
                          <span className="text-text-muted text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-text-secondary">
                        {client.mac_address}
                      </td>
                      <td className="px-6 py-4">
                        {client.has_active_session ? (
                          <span className="text-green-400 text-sm flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                            Ativa
                          </span>
                        ) : (
                          <span className="text-text-muted text-sm flex items-center gap-1">
                            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewPlaylists(client)}
                          className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-fast mr-1"
                          title="Ver Playlists"
                        >
                          <List size={18} />
                        </button>
                        <button
                          onClick={() => handleEditClient(client)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-fast mr-1"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-fast"
                          title="Deletar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border-color">
              {clients.map((client) => (
                <div key={client.id} className="p-4 hover:bg-bg-hover transition-fast">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-text-primary truncate">{client.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${playerBadge[client.player_type]?.bg} ${playerBadge[client.player_type]?.text}`}>
                          {playerBadge[client.player_type]?.label}
                        </span>
                      </div>
                      <code className="text-xs text-text-muted font-mono mt-1 block">
                        {client.mac_address}
                      </code>
                    </div>
                    {client.has_active_session ? (
                      <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 mt-2"></span>
                    ) : (
                      <span className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0 mt-2"></span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-text-muted">
                      {client.server_name ? (
                        <span>{client.server_color} {client.server_name}</span>
                      ) : (
                        <span>Sem servidor</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewPlaylists(client)}
                        className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-fast"
                      >
                        <List size={16} />
                      </button>
                      <button
                        onClick={() => handleEditClient(client)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-fast"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-fast"
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
      </div>
      
      {/* Modal: Adicionar Cliente */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Plus size={20} className="text-purple-500" />
                Novo Cliente
              </h2>
              <button onClick={() => setShowAddClient(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            {/* Botão de Scan de Imagem */}
            <div className="px-6 pt-4">
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all cursor-pointer disabled:opacity-50">
                {scanningImage ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    Escanear MAC e Device Key por Foto
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={scanningImage}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleScanImage(e.target.files[0], 'add');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <p className="text-xs text-text-muted text-center mt-1.5">
                Envie uma foto da tela do aplicativo para extrair automaticamente
              </p>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo de Player</label>
                <select
                  value={clientForm.player_type}
                  onChange={(e) => setClientForm({ ...clientForm, player_type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  <option value="iboplayer">IBOPlayer</option>
                  <option value="ibopro">IBOPro</option>
                  <option value="vuplayer">VUPlayer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">MAC Address</label>
                <input
                  type="text"
                  value={clientForm.mac_address}
                  onChange={(e) => setClientForm({ ...clientForm, mac_address: e.target.value })}
                  placeholder="00:1A:79:XX:XX:XX"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {clientForm.player_type === 'ibopro' ? 'Senha' : 'Device Key'}
                </label>
                <input
                  type="text"
                  value={clientForm.player_type === 'ibopro' ? clientForm.password : clientForm.device_key}
                  onChange={(e) => {
                    if (clientForm.player_type === 'ibopro') {
                      setClientForm({ ...clientForm, password: e.target.value, device_key: e.target.value });
                    } else {
                      setClientForm({ ...clientForm, device_key: e.target.value, password: e.target.value });
                    }
                  }}
                  placeholder={clientForm.player_type === 'ibopro' ? 'Senha do dispositivo' : '123456'}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  required
                />
              </div>
              
              {clientForm.player_type === 'iboplayer' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Domínio</label>
                  <select
                    value={clientForm.domain}
                    onChange={(e) => setClientForm({ ...clientForm, domain: e.target.value })}
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    required
                  >
                    <option value="">Selecione um domínio...</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.domain}>{d.domain}</option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1.5">
                    Não encontrou?{' '}
                    <button
                      type="button"
                      onClick={() => { setShowAddClient(false); setShowDomains(true); }}
                      className="text-purple-400 hover:underline"
                    >
                      Adicionar domínio
                    </button>
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Notas (opcional)</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                  rows={2}
                  placeholder="Observações sobre o cliente..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Servidor (opcional)</label>
                <select
                  value={clientForm.server_id}
                  onChange={(e) => setClientForm({ ...clientForm, server_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  <option value="">Nenhum servidor</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.color} {s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-text-muted mt-1.5">
                  Use servidores para organizar clientes em grupos
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {savingClient && <Loader2 size={16} className="animate-spin" />}
                  Criar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal: Editar Cliente */}
      {showEditClient && editingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Edit size={20} className="text-blue-500" />
                Editar Cliente
              </h2>
              <button onClick={() => setShowEditClient(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            {/* Botão de Scan de Imagem */}
            <div className="px-6 pt-4">
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all cursor-pointer disabled:opacity-50">
                {scanningImage ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    Escanear MAC e Device Key por Foto
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={scanningImage}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleScanImage(e.target.files[0], 'edit');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <p className="text-xs text-text-muted text-center mt-1.5">
                Envie uma foto para atualizar MAC e/ou Device Key
              </p>
            </div>
            
            <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editClientForm.name}
                  onChange={(e) => setEditClientForm({ ...editClientForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo de Player</label>
                <select
                  value={editClientForm.player_type}
                  onChange={(e) => setEditClientForm({ ...editClientForm, player_type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  disabled
                >
                  <option value="iboplayer">IBOPlayer</option>
                  <option value="ibopro">IBOPro</option>
                  <option value="vuplayer">VUPlayer</option>
                </select>
                <p className="text-xs text-text-muted mt-1">O tipo de player não pode ser alterado</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">MAC Address</label>
                <input
                  type="text"
                  value={editClientForm.mac_address}
                  onChange={(e) => setEditClientForm({ ...editClientForm, mac_address: e.target.value })}
                  placeholder="00:1A:79:XX:XX:XX"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {editClientForm.player_type === 'ibopro' ? 'Senha' : 'Device Key'}
                </label>
                <input
                  type="text"
                  value={editClientForm.player_type === 'ibopro' ? editClientForm.password : editClientForm.device_key}
                  onChange={(e) => {
                    if (editClientForm.player_type === 'ibopro') {
                      setEditClientForm({ ...editClientForm, password: e.target.value, device_key: e.target.value });
                    } else {
                      setEditClientForm({ ...editClientForm, device_key: e.target.value, password: e.target.value });
                    }
                  }}
                  placeholder={editClientForm.player_type === 'ibopro' ? 'Senha do dispositivo' : '123456'}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  required
                />
              </div>
              
              {editClientForm.player_type === 'iboplayer' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Domínio</label>
                  <select
                    value={editClientForm.domain}
                    onChange={(e) => setEditClientForm({ ...editClientForm, domain: e.target.value })}
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    required
                  >
                    <option value="">Selecione um domínio...</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.domain}>{d.domain}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Notas (opcional)</label>
                <textarea
                  value={editClientForm.notes}
                  onChange={(e) => setEditClientForm({ ...editClientForm, notes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
                  rows={2}
                  placeholder="Observações sobre o cliente..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Servidor (opcional)</label>
                <select
                  value={editClientForm.server_id}
                  onChange={(e) => setEditClientForm({ ...editClientForm, server_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="">Nenhum servidor</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.color} {s.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-400">
                  ⚠️ Alterar credenciais (MAC, Device Key, Senha ou Domínio) irá invalidar a sessão atual e exigirá novo login.
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setShowEditClient(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditClient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {savingEditClient && <Loader2 size={16} className="animate-spin" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal: Domínios */}
      {showDomains && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Globe size={20} className="text-purple-500" />
                Domínios Cadastrados
              </h2>
              <button onClick={() => setShowDomains(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Lista de domínios */}
              <div className="mb-6 max-h-48 overflow-y-auto">
                {domains.length === 0 ? (
                  <p className="text-text-muted text-center py-6">Nenhum domínio cadastrado</p>
                ) : (
                  <ul className="space-y-2">
                    {domains.map((d) => (
                      <li key={d.id} className="flex justify-between items-center p-3 bg-bg-tertiary rounded-lg">
                        <div>
                          <span className="font-mono text-sm text-text-primary">{d.domain}</span>
                          {d.description && (
                            <span className="text-xs text-text-muted ml-2">({d.description})</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteDomain(d)}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-fast"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="border-t border-border-color pt-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Adicionar Novo</h3>
                <form onSubmit={handleCreateDomain} className="space-y-3">
                  <input
                    type="text"
                    value={domainForm.domain}
                    onChange={(e) => setDomainForm({ ...domainForm, domain: e.target.value })}
                    placeholder="painel.exemplo.com"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    required
                  />
                  <input
                    type="text"
                    value={domainForm.description}
                    onChange={(e) => setDomainForm({ ...domainForm, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={savingDomain}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingDomain && <Loader2 size={16} className="animate-spin" />}
                    Adicionar Domínio
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Servidores (Tags) */}
      {showServers && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Server size={20} className="text-purple-500" />
                Servidores (Tags)
              </h2>
              <button onClick={() => setShowServers(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-text-muted mb-4">
                Servidores servem para agrupar clientes e facilitar a troca de DNS em massa.
              </p>
              
              {/* Lista de servidores */}
              <div className="mb-6 max-h-48 overflow-y-auto">
                {servers.length === 0 ? (
                  <p className="text-text-muted text-center py-6">Nenhum servidor cadastrado</p>
                ) : (
                  <ul className="space-y-2">
                    {servers.map((s) => (
                      <li key={s.id} className="flex justify-between items-center p-3 bg-bg-tertiary rounded-lg">
                        <div>
                          <span className="text-text-primary">{s.color} {s.name}</span>
                          <span className="text-xs text-text-muted ml-2">({s.client_count || 0} clientes)</span>
                          {s.description && (
                            <p className="text-xs text-text-muted mt-0.5">{s.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteServer(s)}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-fast"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="border-t border-border-color pt-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Adicionar Novo</h3>
                <form onSubmit={handleCreateServer} className="space-y-3">
                  <input
                    type="text"
                    value={serverForm.name}
                    onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                    placeholder="Nome do servidor"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    required
                  />
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Cor/Emoji</label>
                    <div className="flex gap-2 flex-wrap">
                      {serverColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setServerForm({ ...serverForm, color })}
                          className={`w-8 h-8 text-lg flex items-center justify-center rounded-lg transition-fast ${
                            serverForm.color === color 
                              ? 'bg-purple-500/30 ring-2 ring-purple-500' 
                              : 'bg-bg-tertiary hover:bg-bg-hover'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={serverForm.description}
                    onChange={(e) => setServerForm({ ...serverForm, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={savingServer}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingServer && <Loader2 size={16} className="animate-spin" />}
                    Adicionar Servidor
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Troca DNS em Massa */}
      {showBulkDns && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Zap size={20} className="text-orange-500" />
                Trocar DNS em Massa
              </h2>
              <button onClick={() => setShowBulkDns(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Step 1: Seleção de clientes */}
              {bulkDnsStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">
                    Selecione os clientes que terão o DNS alterado. Você pode selecionar por servidor ou manualmente.
                  </p>
                  
                  {/* Seleção por servidor */}
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <h3 className="text-sm font-medium text-text-primary mb-3">Selecionar por Servidor</h3>
                    {servers.length === 0 ? (
                      <p className="text-xs text-text-muted">Nenhum servidor cadastrado</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {servers.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectAllFromServer(s.id)}
                            className="px-3 py-1.5 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-hover transition-fast text-sm flex items-center gap-1"
                          >
                            {s.color} {s.name}
                            <span className="text-xs text-text-muted">({s.client_count || 0})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Seleção manual */}
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <h3 className="text-sm font-medium text-text-primary mb-3">
                      Seleção Manual 
                      <span className="text-xs text-text-muted ml-2">
                        ({selectedClientsForBulk.length} selecionado{selectedClientsForBulk.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {clients.map((c) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-fast ${
                            selectedClientsForBulk.includes(c.id) ? 'bg-purple-500/20' : 'hover:bg-bg-hover'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedClientsForBulk.includes(c.id)}
                            onChange={() => toggleClientForBulk(c.id)}
                            className="w-4 h-4 rounded border-border-color text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary truncate">{c.name}</div>
                            <div className="text-xs text-text-muted flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${playerBadge[c.player_type]?.bg} ${playerBadge[c.player_type]?.text}`}>
                                {playerBadge[c.player_type]?.label}
                              </span>
                              {c.server_name && <span>{c.server_color} {c.server_name}</span>}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                    <button
                      type="button"
                      onClick={() => setShowBulkDns(false)}
                      className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setBulkDnsStep(2)}
                      disabled={selectedClientsForBulk.length === 0}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-fast disabled:opacity-50"
                    >
                      Continuar ({selectedClientsForBulk.length} clientes)
                    </button>
                  </div>
                </div>
              )}
              
              {/* Step 2: Configuração */}
              {bulkDnsStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <p className="text-sm text-text-muted">
                      <span className="text-text-primary font-medium">{selectedClientsForBulk.length}</span> cliente(s) selecionado(s)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Modo de Troca</label>
                    <select
                      value={bulkDnsForm.mode}
                      onChange={(e) => setBulkDnsForm({ ...bulkDnsForm, mode: e.target.value })}
                      className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                    >
                      <option value="all">📋 Trocar TODAS as playlists</option>
                      <option value="first">1️⃣ Trocar apenas a PRIMEIRA playlist</option>
                      <option value="specific">🎯 Trocar domínio ESPECÍFICO</option>
                    </select>
                    <p className="text-xs text-text-muted mt-1.5">
                      {bulkDnsForm.mode === 'all' && 'Todas as playlists de cada cliente terão o domínio alterado.'}
                      {bulkDnsForm.mode === 'first' && 'Apenas a primeira playlist de cada cliente será alterada.'}
                      {bulkDnsForm.mode === 'specific' && 'Apenas playlists com o domínio antigo especificado serão alteradas.'}
                    </p>
                  </div>
                  
                  {bulkDnsForm.mode === 'specific' && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Domínio Antigo</label>
                      <input
                        type="text"
                        value={bulkDnsForm.old_domain}
                        onChange={(e) => setBulkDnsForm({ ...bulkDnsForm, old_domain: e.target.value })}
                        placeholder="servidor-antigo.com"
                        className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Novo Domínio</label>
                    <input
                      type="text"
                      value={bulkDnsForm.new_domain}
                      onChange={(e) => setBulkDnsForm({ ...bulkDnsForm, new_domain: e.target.value })}
                      placeholder="servidor-novo.com"
                      className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      required
                    />
                  </div>
                  
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-xs text-yellow-400">
                      ⚠️ Esta ação irá fazer login em cada cliente, listar todas as playlists e alterar o domínio conforme configurado. O processo pode demorar alguns minutos.
                    </p>
                  </div>
                  
                  <div className="flex justify-between gap-3 pt-4 border-t border-border-color">
                    <button
                      type="button"
                      onClick={() => setBulkDnsStep(1)}
                      className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={handleExecuteBulkDns}
                      disabled={!bulkDnsForm.new_domain || (bulkDnsForm.mode === 'specific' && !bulkDnsForm.old_domain)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-fast disabled:opacity-50 flex items-center gap-2"
                    >
                      <Zap size={16} />
                      Executar Troca
                    </button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Execução/Resultados */}
              {bulkDnsStep === 3 && (
                <div className="space-y-4">
                  {executingBulkDns ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                      <p className="text-text-primary font-medium">Executando troca de DNS...</p>
                      <p className="text-sm text-text-muted mt-1">Isso pode demorar alguns minutos</p>
                    </div>
                  ) : bulkDnsResults && (
                    <div className="space-y-4">
                      {bulkDnsResults.error ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <p className="text-red-400">❌ Erro: {bulkDnsResults.error}</p>
                        </div>
                      ) : (
                        <>
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-400 font-medium mb-2">✅ Troca Concluída!</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-bg-tertiary rounded p-2">
                                <span className="text-text-muted">Total:</span>
                                <span className="text-text-primary ml-2">{bulkDnsResults.total}</span>
                              </div>
                              <div className="bg-bg-tertiary rounded p-2">
                                <span className="text-green-400">✓ Sucesso:</span>
                                <span className="text-text-primary ml-2">{bulkDnsResults.success}</span>
                              </div>
                              <div className="bg-bg-tertiary rounded p-2">
                                <span className="text-yellow-400">⏭ Pulados:</span>
                                <span className="text-text-primary ml-2">{bulkDnsResults.skipped}</span>
                              </div>
                              <div className="bg-bg-tertiary rounded p-2">
                                <span className="text-red-400">✗ Falhas:</span>
                                <span className="text-text-primary ml-2">{bulkDnsResults.failed}</span>
                              </div>
                            </div>
                            <p className="text-xs text-text-muted mt-2">
                              {bulkDnsResults.playlistsChanged} playlist(s) alterada(s)
                            </p>
                          </div>
                          
                          {bulkDnsResults.errors && bulkDnsResults.errors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                              <p className="text-red-400 font-medium mb-2">Erros:</p>
                              <ul className="text-xs text-red-300 space-y-1 max-h-32 overflow-y-auto">
                                {bulkDnsResults.errors.map((err, i) => (
                                  <li key={i}>• {err}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                      
                      <div className="flex justify-end pt-4 border-t border-border-color">
                        <button
                          onClick={() => setShowBulkDns(false)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-fast"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Playlists do Cliente */}
      {showPlaylists && selectedClient && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPlaylists(false);
              setSelectedClient(null);
            }
          }}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <List size={20} className="text-purple-500" />
                  Playlists
                </h2>
                <p className="text-sm text-text-muted mt-0.5">
                  {selectedClient.name} • <span className="font-mono">{selectedClient.mac_address}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewPlaylists(selectedClient)}
                  className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
                  title="Atualizar"
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => setShowAddPlaylist(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-fast flex items-center gap-1.5 text-sm"
                >
                  <Plus size={16} />
                  Adicionar
                </button>
                <button onClick={() => { setShowPlaylists(false); setSelectedClient(null); }} className="text-text-muted hover:text-text-primary ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {loadingPlaylists ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <span className="ml-3 text-text-muted">Carregando playlists...</span>
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-12">
                  <Tv className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-text-muted">Nenhuma playlist cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playlists.map((pl) => (
                    <div key={pl.id} className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {pl.is_protected ? (
                              <Lock size={16} className="text-yellow-500" />
                            ) : (
                              <Unlock size={16} className="text-green-500" />
                            )}
                            <span className="font-medium text-text-primary">{pl.name}</span>
                            {pl.type && pl.type !== 'general' && (
                              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                {pl.type}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted font-mono truncate mt-1.5" title={pl.url}>
                            {pl.url}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            DNS: <span className="text-cyan-400">{extractDomain(pl.url)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => openChangeDns(pl)}
                            className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-fast"
                            title="Trocar DNS"
                          >
                            <ArrowRightLeft size={16} />
                          </button>
                          <button
                            onClick={() => openEditPlaylist(pl)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-fast"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePlaylist(pl)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-fast"
                            title="Deletar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Adicionar Playlist (z-index maior) */}
      {showAddPlaylist && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddPlaylist(false);
            }
          }}
        >
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Plus size={20} className="text-green-500" />
                Nova Playlist
              </h3>
              <button onClick={() => setShowAddPlaylist(false)} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddPlaylist} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  value={playlistForm.name}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                  placeholder="Nome da playlist"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">URL</label>
                <input
                  type="text"
                  value={playlistForm.url}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, url: e.target.value })}
                  placeholder="http://servidor.com/get.php?username=xxx&password=yyy"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
                <select
                  value={playlistForm.type}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                >
                  <option value="general">Geral</option>
                  <option value="movie">Filmes</option>
                  <option value="series">Séries</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="protect-add"
                  checked={playlistForm.protect}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, protect: e.target.checked })}
                  className="rounded bg-bg-tertiary border-border-color text-green-500 focus:ring-green-500/50"
                />
                <label htmlFor="protect-add" className="text-sm text-text-secondary">Proteger com PIN</label>
              </div>
              
              {playlistForm.protect && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                  <input
                    type="text"
                    value={playlistForm.pin}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, pin: e.target.value })}
                    maxLength={4}
                    placeholder="0000"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setShowAddPlaylist(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlaylist}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {savingPlaylist && <Loader2 size={16} className="animate-spin" />}
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal: Editar Playlist (z-index maior) */}
      {showEditPlaylist && editingPlaylist && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Edit size={20} className="text-blue-500" />
                Editar Playlist
              </h3>
              <button onClick={() => { setShowEditPlaylist(false); setEditingPlaylist(null); }} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditPlaylist} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">URL</label>
                <input
                  type="text"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="general">Geral</option>
                  <option value="movie">Filmes</option>
                  <option value="series">Séries</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="protect-edit"
                  checked={editForm.protect}
                  onChange={(e) => setEditForm({ ...editForm, protect: e.target.checked })}
                  className="rounded bg-bg-tertiary border-border-color text-blue-500 focus:ring-blue-500/50"
                />
                <label htmlFor="protect-edit" className="text-sm text-text-secondary">Proteger com PIN</label>
              </div>
              
              {editForm.protect && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                  <input
                    type="text"
                    value={editForm.pin}
                    onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })}
                    maxLength={4}
                    placeholder="0000"
                    className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => { setShowEditPlaylist(false); setEditingPlaylist(null); }}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {savingEdit && <Loader2 size={16} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal: Trocar DNS (z-index maior) */}
      {showChangeDns && changingPlaylist && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-bg-secondary rounded-xl border border-border-color w-full max-w-md">
            <div className="p-6 border-b border-border-color flex justify-between items-center">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-cyan-500" />
                Trocar DNS
              </h3>
              <button onClick={() => { setShowChangeDns(false); setChangingPlaylist(null); }} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleChangeDns} className="p-6 space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4 border border-border-color">
                <p className="text-sm text-text-secondary mb-1">Playlist:</p>
                <p className="font-medium text-text-primary">{changingPlaylist.name}</p>
                <p className="text-xs text-text-muted font-mono mt-2 truncate">{changingPlaylist.url}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">DNS Atual</label>
                <div className="px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-red-400 font-mono text-sm">
                  {extractDomain(changingPlaylist.url)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Novo DNS</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="novoservidor.com"
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-color rounded-lg text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                  required
                />
                <p className="text-xs text-text-muted mt-1.5">Digite o novo domínio/DNS para substituir na URL</p>
              </div>
              
              {newDomain && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-400">
                    A URL será alterada de <span className="font-mono text-red-400">{extractDomain(changingPlaylist.url)}</span> para <span className="font-mono text-green-400">{newDomain}</span>
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => { setShowChangeDns(false); setChangingPlaylist(null); }}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDns || !newDomain}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-fast flex items-center gap-2 disabled:opacity-50"
                >
                  {savingDns && <Loader2 size={16} className="animate-spin" />}
                  Trocar DNS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
