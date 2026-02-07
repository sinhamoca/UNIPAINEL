// services/api.js
import axios from 'axios';

// Em produção/IP externo, usar a URL completa do backend
// Em desenvolvimento local, usar o proxy do Vite
const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? '/api' : `http://${window.location.hostname}:3001/api`);

console.log('🔌 API URL:', API_URL);

// Criar instância do axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expirado ou inválido
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================

export const authAPI = {
  login: (username, password) => 
    api.post('/auth/login', { username, password }),
  
  register: (username, password, name) => 
    api.post('/auth/register', { username, password, name }),
  
  getMe: () => 
    api.get('/auth/me'),
};

// ==================== GERENCIA (IBO REVENDA) ====================

export const gerenciaAPI = {
  // Contas
  getAccounts: () => 
    api.get('/gerencia/accounts'),
  
  createAccount: (data) => 
    api.post('/gerencia/accounts', data),
  
  getAccount: (id) => 
    api.get(`/gerencia/accounts/${id}`),
  
  updateAccount: (id, data) => 
    api.put(`/gerencia/accounts/${id}`, data),
  
  deleteAccount: (id) => 
    api.delete(`/gerencia/accounts/${id}`),
  
  // Sessão
  connect: (accountId) => 
    api.post(`/gerencia/accounts/${accountId}/connect`),
  
  disconnect: (accountId) => 
    api.post(`/gerencia/accounts/${accountId}/disconnect`),
  
  getStatus: (accountId) => 
    api.get(`/gerencia/accounts/${accountId}/status`),
  
  // Usuários
  getUsers: (accountId, params = {}) => 
    api.get(`/gerencia/accounts/${accountId}/users`, { params }),
  
  searchUsers: (accountId, query) => 
    api.get(`/gerencia/accounts/${accountId}/users/search`, { params: { q: query } }),
  
  createUser: (accountId, data) => 
    api.post(`/gerencia/accounts/${accountId}/users`, data),
  
  updateUser: (accountId, userId, data) => 
    api.put(`/gerencia/accounts/${accountId}/users/${userId}`, data),
  
  renewUser: (accountId, userId, days) => 
    api.post(`/gerencia/accounts/${accountId}/users/${userId}/renew`, { days }),
  
  deleteUser: (accountId, userId) => 
    api.delete(`/gerencia/accounts/${accountId}/users/${userId}`),
  
  // Quick Change DNS
  quickChangeDns: (accountId, userId, newDns) => 
    api.post(`/gerencia/accounts/${accountId}/users/${userId}/quick-dns`, { new_dns: newDns }),
  
  // Dashboard / Stats
  getDashboard: (accountId) => 
    api.get(`/gerencia/accounts/${accountId}/dashboard`),
  
  // Sync cache
  syncCache: (accountId, pages = 5) => 
    api.post(`/gerencia/accounts/${accountId}/sync`, { pages }),
  
  // Logs
  getLogs: (accountId, limit = 50) => 
    api.get(`/gerencia/accounts/${accountId}/logs`, { params: { limit } }),
};

// ==================== KOFFICE ====================

export const kofficeAPI = {
  // Contas
  getAccounts: () => 
    api.get('/koffice/accounts'),
  
  createAccount: (data) => 
    api.post('/koffice/accounts', data),
  
  updateAccount: (id, data) => 
    api.put(`/koffice/accounts/${id}`, data),
  
  deleteAccount: (id) => 
    api.delete(`/koffice/accounts/${id}`),
  
  // Sessão
  connect: (accountId) => 
    api.post(`/koffice/accounts/${accountId}/connect`),
  
  disconnect: (accountId) => 
    api.post(`/koffice/accounts/${accountId}/disconnect`),
  
  // Clientes
  getClients: (accountId, params = {}) => 
    api.get(`/koffice/accounts/${accountId}/clients`, { params }),
  
  searchClients: (accountId, query, limit = 20) => 
    api.get(`/koffice/accounts/${accountId}/clients/search`, { params: { q: query, limit } }),
  
  getClientDetails: (accountId, clientId) =>
    api.get(`/koffice/accounts/${accountId}/clients/${clientId}`),
  
  renewClient: (accountId, clientId, months) => 
    api.post(`/koffice/accounts/${accountId}/clients/${clientId}/renew`, { months }),
  
  updateNotes: (accountId, clientId, notes) => 
    api.put(`/koffice/accounts/${accountId}/clients/${clientId}/notes`, { notes }),
  
  // Teste
  createTest: (accountId) => 
    api.post(`/koffice/accounts/${accountId}/test`),
  
  // Dados do cliente (fast_message)
  getClientData: (accountId, clientId) =>
    api.get(`/koffice/accounts/${accountId}/clients/${clientId}/data`),
  
  // Dashboard
  getDashboard: (accountId) => 
    api.get(`/koffice/accounts/${accountId}/dashboard`),
  
  // Revendas
  getResellers: (accountId, params = {}) => 
    api.get(`/koffice/accounts/${accountId}/resellers`, { params }),
  
  searchResellers: (accountId, query, limit = 20) => 
    api.get(`/koffice/accounts/${accountId}/resellers/search`, { params: { q: query, limit } }),
  
  getResellerDetails: (accountId, resellerId) =>
    api.get(`/koffice/accounts/${accountId}/resellers/${resellerId}`),
  
  createReseller: (accountId, data) => 
    api.post(`/koffice/accounts/${accountId}/resellers`, data),
  
  renewReseller: (accountId, resellerId, months) => 
    api.post(`/koffice/accounts/${accountId}/resellers/${resellerId}/renew`, { months }),
  
  // Créditos
  getCredits: (accountId) => 
    api.get(`/koffice/accounts/${accountId}/credits`),
  
  addCredits: (accountId, resellerId, credits) => 
    api.post(`/koffice/accounts/${accountId}/resellers/${resellerId}/credits/add`, { credits }),
  
  removeCredits: (accountId, resellerId, credits) => 
    api.post(`/koffice/accounts/${accountId}/resellers/${resellerId}/credits/remove`, { credits }),
};

// ==================== PLAYLIST MANAGER ====================

export const playlistAPI = {
  // Domínios
  getDomains: () => 
    api.get('/playlist/domains'),
  
  createDomain: (data) => 
    api.post('/playlist/domains', data),
  
  deleteDomain: (id) => 
    api.delete(`/playlist/domains/${id}`),
  
  // Clientes
  getClients: () => 
    api.get('/playlist/clients'),
  
  searchClients: (query) => 
    api.get(`/playlist/clients/search?q=${encodeURIComponent(query)}`),
  
  getClient: (id) => 
    api.get(`/playlist/clients/${id}`),
  
  createClient: (data) => 
    api.post('/playlist/clients', data),
  
  updateClient: (id, data) => 
    api.put(`/playlist/clients/${id}`, data),
  
  deleteClient: (id) => 
    api.delete(`/playlist/clients/${id}`),
  
  // Playlists do cliente
  getPlaylists: (clientId) => 
    api.get(`/playlist/clients/${clientId}/playlists`),
  
  addPlaylist: (clientId, data) => 
    api.post(`/playlist/clients/${clientId}/playlists`, data),
  
  editPlaylist: (clientId, playlistId, data) => 
    api.put(`/playlist/clients/${clientId}/playlists/${playlistId}`, data),
  
  deletePlaylist: (clientId, playlistId) => 
    api.delete(`/playlist/clients/${clientId}/playlists/${playlistId}`),
  
  changeDomain: (clientId, playlistId, newDomain) => 
    api.post(`/playlist/clients/${clientId}/playlists/${playlistId}/change-domain`, { newDomain }),
  
  // Estatísticas
  getStats: () => 
    api.get('/playlist/stats'),
  
  getLogs: (limit = 50) => 
    api.get(`/playlist/logs?limit=${limit}`),
  
  cleanSessions: () => 
    api.post('/playlist/clean-sessions'),
  
  // Servidores (Tags/Grupos)
  getServers: () => 
    api.get('/playlist/servers'),
  
  createServer: (data) => 
    api.post('/playlist/servers', data),
  
  updateServer: (id, data) => 
    api.put(`/playlist/servers/${id}`, data),
  
  deleteServer: (id) => 
    api.delete(`/playlist/servers/${id}`),
  
  // Troca de DNS em massa
  bulkDns: (data) => 
    api.post('/playlist/bulk-dns', data),
  
  // OCR - Escanear imagem
  scanImage: (image) => 
    api.post('/playlist/scan-image', { image }),
};

// ==================== SIGMA ====================

export const sigmaAPI = {
  // Contas
  getAccounts: () => 
    api.get('/sigma/accounts'),
  
  createAccount: (data) => 
    api.post('/sigma/accounts', data),
  
  updateAccount: (id, data) => 
    api.put(`/sigma/accounts/${id}`, data),
  
  deleteAccount: (id) => 
    api.delete(`/sigma/accounts/${id}`),
  
  // Sessão
  connect: (accountId) => 
    api.post(`/sigma/accounts/${accountId}/connect`),
  
  // Clientes
  getCustomers: (accountId, params = {}) => 
    api.get(`/sigma/accounts/${accountId}/customers`, { params }),
  
  getCustomer: (accountId, customerId) => 
    api.get(`/sigma/accounts/${accountId}/customers/${customerId}`),
  
  // Buscar playlist/dados completos do cliente
  getCustomerPlaylist: (accountId, customerId) => 
    api.get(`/sigma/accounts/${accountId}/customers/${customerId}/playlist`),
  
  // Pacotes
  getPackages: (accountId) => 
    api.get(`/sigma/accounts/${accountId}/packages`),
  
  // Pacotes de Teste (Trial)
  getTrialPackages: (accountId) => 
    api.get(`/sigma/accounts/${accountId}/packages/trial`),
  
  // Criar Teste (Trial)
  createTrialCustomer: (accountId, data) => 
    api.post(`/sigma/accounts/${accountId}/customers/trial`, data),
  
  // Renovação
  renewCustomer: (accountId, customerId, packageId, connections = 1) => 
    api.post(`/sigma/accounts/${accountId}/customers/${customerId}/renew`, { 
      package_id: packageId, 
      connections 
    }),
  
  // Revendedores
  getResellers: (accountId, params = {}) => 
    api.get(`/sigma/accounts/${accountId}/resellers`, { params }),
  
  addCredits: (accountId, resellerId, credits) => 
    api.post(`/sigma/accounts/${accountId}/resellers/${resellerId}/add-credits`, { credits }),
  
  removeCredits: (accountId, resellerId, credits) => 
    api.post(`/sigma/accounts/${accountId}/resellers/${resellerId}/remove-credits`, { credits }),
};

// ==================== UNIPLAY ====================

export const uniplayAPI = {
  // Contas
  getAccounts: () => 
    api.get('/uniplay/accounts'),
  
  createAccount: (data) => 
    api.post('/uniplay/accounts', data),
  
  updateAccount: (id, data) => 
    api.put(`/uniplay/accounts/${id}`, data),
  
  deleteAccount: (id) => 
    api.delete(`/uniplay/accounts/${id}`),
  
  // Teste de conexão
  testConnection: (accountId) => 
    api.post(`/uniplay/accounts/${accountId}/test`),
  
  // Clientes
  getClients: (accountId, type = 'all') => 
    api.get(`/uniplay/accounts/${accountId}/clients`, { params: { type } }),
  
  searchClient: (accountId, name, type = 'auto') => 
    api.get(`/uniplay/accounts/${accountId}/clients/search`, { params: { name, type } }),
  
  // Renovação
  renewClient: (accountId, clientId, data) => 
    api.post(`/uniplay/accounts/${accountId}/clients/${clientId}/renew`, data),
  
  // Criar Teste
  createTrial: (accountId, data = {}) => 
    api.post(`/uniplay/accounts/${accountId}/trial`, data),
  
  // Status
  getStatus: () => 
    api.get('/uniplay/status'),
};

// ==================== WORKFLOWS ====================

export const workflowAPI = {
  // Listar workflows
  getWorkflows: () => 
    api.get('/workflows'),
  
  // Obter workflow específico
  getWorkflow: (id) => 
    api.get(`/workflows/${id}`),
  
  // Criar workflow
  createWorkflow: (data) => 
    api.post('/workflows', data),

  // editar workflow
  updateWorkflow: (id, data) => 
    api.put(`/workflows/${id}`, data),
  
  // Atualizar workflow
  updateWorkflow: (id, data) => 
    api.put(`/workflows/${id}`, data),
  
  // Excluir workflow
  deleteWorkflow: (id) => 
    api.delete(`/workflows/${id}`),
  
  // Executar workflow
  executeWorkflow: (id, data) => 
    api.post(`/workflows/${id}/execute`, data),
  
  // Obter logs de execução
  getWorkflowLogs: (id, limit = 20) => 
    api.get(`/workflows/${id}/logs`, { params: { limit } }),
  
  // Contas disponíveis para configuração
  getKofficeAccounts: () => 
    api.get('/workflows/accounts/koffice'),
  
  getIboAccounts: () => 
    api.get('/workflows/accounts/ibo'),
  
  getSigmaAccounts: () => 
    api.get('/workflows/accounts/sigma'),

  getUniplayAccounts: () => 
    api.get('/workflows/accounts/uniplay'),

  // Pacotes do Sigma (para pré-configurar no workflow)
  getSigmaPackages: (accountId) => 
    api.get(`/workflows/accounts/sigma/${accountId}/packages`),
};

export default api;