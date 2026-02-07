// ==================== UNIPLAY ====================
// Adicionar ao arquivo /frontend/src/services/api.js

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
  
  // Status
  getStatus: () => 
    api.get('/uniplay/status'),
};
