// =============================================
// SIGMA CLIENT - INDEX
// Exporta cliente unificado para uso nas rotas
// =============================================

import SigmaSession from './sigma-session.js';
import SigmaAPI from './sigma-api.js';
import sigmaKeeper from './sigma-keeper.js';
import { run, get } from '../../config/database.js';

// Cache de clientes ativos
const clientCache = new Map();

/**
 * SigmaClient - Cliente unificado que combina Session + API
 */
class SigmaClient {
  constructor(account) {
    this.session = new SigmaSession(account);
    this.api = new SigmaAPI(this.session);
    this.accountId = account.id;
  }

  // Proxy para métodos da API
  async getCustomers(...args) { return this.api.getCustomers(...args); }
  async getCustomerDetails(...args) { return this.api.getCustomerDetails(...args); }
  async findCustomerByUsername(...args) { return this.api.findCustomerByUsername(...args); }
  async getCustomerPlaylist(...args) { return this.api.getCustomerPlaylist(...args); }
  async getServersAndPackages(...args) { return this.api.getServersAndPackages(...args); }
  async getTrialPackages(...args) { return this.api.getTrialPackages(...args); }
  async renewCustomer(...args) { return this.api.renewCustomer(...args); }
  async createTrialCustomer(...args) { return this.api.createTrialCustomer(...args); }
  async getResellers(...args) { return this.api.getResellers(...args); }
  async findResellerById(...args) { return this.api.findResellerById(...args); }
  async addCredits(...args) { return this.api.addCredits(...args); }
  async removeCredits(...args) { return this.api.removeCredits(...args); }

  // Métodos da sessão
  async login() {
    const result = await this.session.login();
    
    // Salvar token no banco
    if (result.token) {
      await this.saveTokenToDB(result.token);
    }
    
    return result;
  }
  
  async checkSession() { return this.session.checkSession(); }
  async ensureLoggedIn() { return this.session.ensureLoggedIn(); }
  getSessionInfo() { return this.session.getSessionInfo(); }
  getToken() { return this.session.getToken(); }

  // Salvar token no banco
  async saveTokenToDB(token) {
    try {
      const validUntil = new Date();
      validUntil.setHours(validUntil.getHours() + 24);

      run(`
        UPDATE sigma_accounts 
        SET auth_token = ?, session_valid_until = ?
        WHERE id = ?
      `, [token, validUntil.toISOString(), this.accountId]);

      console.log(`[SigmaClient:${this.accountId}] Token salvo no banco`);
    } catch (error) {
      console.error(`[SigmaClient:${this.accountId}] Erro ao salvar token:`, error.message);
    }
  }
}

// =============================================
// CLIENT MANAGEMENT
// =============================================

/**
 * Obtém ou cria cliente para uma conta
 */
function getSigmaClient(account) {
  const accountId = account.id;
  
  // Retornar do cache se existir
  if (clientCache.has(accountId)) {
    console.log(`[SigmaClient:${accountId}] Retornando cliente do cache`);
    return clientCache.get(accountId);
  }
  
  // Criar novo cliente
  console.log(`[SigmaClient:${accountId}] Criando novo cliente`);
  const client = new SigmaClient(account);
  clientCache.set(accountId, client);
  
  // Adicionar ao keeper se tiver token
  if (account.auth_token) {
    sigmaKeeper.addSession(account);
  }
  
  return client;
}

/**
 * Remove cliente do cache
 */
function clearSigmaClient(accountId) {
  if (clientCache.has(accountId)) {
    clientCache.delete(accountId);
    sigmaKeeper.removeSession(accountId);
    console.log(`[SigmaClient:${accountId}] Cliente removido do cache`);
  }
}

/**
 * Obtém cliente autenticado (com login automático se necessário)
 */
async function getAuthenticatedClient(accountId) {
  console.log(`[SIGMA] getAuthenticatedClient para conta ${accountId}`);
  
  const account = get('SELECT * FROM sigma_accounts WHERE id = ?', [accountId]);
  
  if (!account) {
    throw new Error('Conta não encontrada');
  }
  
  const client = getSigmaClient(account);
  
  // Verificar se precisa fazer login
  const now = new Date();
  const isValid = account.session_valid_until && new Date(account.session_valid_until) > now;
  
  if (!isValid || !account.auth_token) {
    console.log(`[SIGMA] Sessão expirada ou sem token, fazendo login...`);
    await client.login();
  } else {
    console.log(`[SIGMA] Usando token existente`);
  }
  
  return { client, account };
}

// =============================================
// KEEPER AUTO-START
// =============================================

// Iniciar keeper automaticamente
sigmaKeeper.start();

// =============================================
// KEEPER STATUS
// =============================================

function getSigmaKeeperStatus() {
  return sigmaKeeper.getStatus();
}

// =============================================
// EXPORTS
// =============================================

export {
  SigmaClient,
  getSigmaClient,
  clearSigmaClient,
  getAuthenticatedClient,
  sigmaKeeper,
  getSigmaKeeperStatus
};

export default SigmaClient;
