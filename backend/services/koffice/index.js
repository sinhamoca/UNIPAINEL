// =============================================
// KOFFICE MODULE
// Factory e exports públicos
// =============================================

import KofficeSession from './koffice-session.js';
import KofficeAPI from './koffice-api.js';
import sessionKeeper from './koffice-keeper.js';
import * as parser from './koffice-parser.js';

// =============================================
// CLIENT INSTANCES CACHE
// =============================================
const clientInstances = new Map();

// =============================================
// KOFFICE CLIENT (Wrapper)
// Combina Session + API em uma interface unificada
// =============================================
class KofficeClient {
  constructor(session, api) {
    this.session = session;
    this.api = api;
    this.accountId = session.accountId;
    this.domain = session.domain;
  }

  // Proxy para métodos da sessão
  get loggedIn() { return this.session.loggedIn; }
  get cookies() { return this.session.getCookies(); }
  set cookies(value) { this.session.setCookies(value); }

  async login() { return this.session.login(); }
  async checkSession() { return this.session.checkSession(); }
  async ensureLoggedIn() { return this.session.ensureLoggedIn(); }
  async restoreSession() { return this.session.restoreSession(); }
  async saveSession() { return this.session.saveSession(); }
  getSessionInfo() { return this.session.getSessionInfo(); }

  // Proxy para métodos da API - Clientes
  async searchClients(searchTerm, limit) { return this.api.searchClients(searchTerm, limit); }
  async getClients(page, perPage) { return this.api.getClients(page, perPage); }
  async renewClient(clientId, months) { return this.api.renewClient(clientId, months); }
  async resetClientAttribute(clientId, attribute) { return this.api.resetClientAttribute(clientId, attribute); }
  async editClientNotes(clientId, notes) { return this.api.editClientNotes(clientId, notes); }
  async getClientFastMessage(clientId) { return this.api.getClientFastMessage(clientId); }
  async createFastTest() { return this.api.createFastTest(); }

  // Proxy para métodos da API - Revendedores
  async searchResellers(searchTerm, limit) { return this.api.searchResellers(searchTerm, limit); }
  async getResellers(page, perPage) { return this.api.getResellers(page, perPage); }
  async getResellerDetails(resellerId) { return this.api.getResellerDetails(resellerId); }
  async createReseller(data) { return this.api.createReseller(data); }
  async renewReseller(resellerId, months) { return this.api.renewReseller(resellerId, months); }

  // Proxy para métodos da API - Créditos
  async getCredits() { return this.api.getCredits(); }
  async addCreditsToReseller(resellerId, credits) { return this.api.addCreditsToReseller(resellerId, credits); }
  async removeCreditsFromReseller(resellerId, credits) { return this.api.removeCreditsFromReseller(resellerId, credits); }

  // Log
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KofficeClient:${this.accountId}] [${level}] ${message}`);
  }
}

// =============================================
// FACTORY: Get Koffice Client
// =============================================
export function getKofficeClient(account) {
  const key = `koffice_${account.id}`;

  if (!clientInstances.has(key)) {
    // Criar nova instância
    const session = new KofficeSession(account);
    const api = new KofficeAPI(session);
    const client = new KofficeClient(session, api);

    // Restaurar cookies do banco se existirem
    if (account.session_cookies) {
      try {
        const dbCookies = JSON.parse(account.session_cookies);
        if (dbCookies && Object.keys(dbCookies).length > 0) {
          session.setCookies(dbCookies);
          console.log(`[KofficeClient:${account.id}] Cookies restaurados do banco na criação`);

          // Verificar se sessão ainda é válida pelo timestamp
          if (account.session_valid_until) {
            const validUntil = new Date(account.session_valid_until);
            if (validUntil > new Date()) {
              console.log(`[KofficeClient:${account.id}] Sessão potencialmente válida até ${validUntil.toISOString()}`);
            }
          }
        }
      } catch (e) {
        console.log(`[KofficeClient:${account.id}] Erro ao restaurar cookies: ${e.message}`);
      }
    }

    clientInstances.set(key, client);

    // Adicionar ao session keeper automaticamente
    sessionKeeper.addSession(account.id, session, api);

  } else {
    // Atualizar dados da conta no cliente existente
    const client = clientInstances.get(key);
    client.session.account = account;

    // Se os cookies do banco são mais recentes e o cliente não está logado,
    // restaurar a sessão do banco
    if (account.session_cookies && !client.session.loggedIn) {
      try {
        const dbCookies = JSON.parse(account.session_cookies);
        if (Object.keys(dbCookies).length > 0) {
          client.session.setCookies(dbCookies);
          console.log(`[KofficeClient:${account.id}] Cookies atualizados do banco`);
        }
      } catch (e) {
        // Ignorar erro de parse
      }
    }
  }

  return clientInstances.get(key);
}

// =============================================
// FACTORY: Clear Koffice Client
// =============================================
export function clearKofficeClient(accountId) {
  const key = `koffice_${accountId}`;
  
  // Remover do keeper
  sessionKeeper.removeSession(accountId);
  
  // Remover do cache
  clientInstances.delete(key);
  
  console.log(`[KofficeClient:${accountId}] Instância removida`);
}

// =============================================
// FACTORY: Get All Clients
// =============================================
export function getAllKofficeClients() {
  return Array.from(clientInstances.values());
}

// =============================================
// KEEPER: Start/Stop
// =============================================
export function startSessionKeeper() {
  sessionKeeper.start();
}

export function stopSessionKeeper() {
  sessionKeeper.stop();
}

export function getKeeperStatus() {
  return sessionKeeper.getStatus();
}

// =============================================
// EXPORTS
// =============================================
export {
  KofficeSession,
  KofficeAPI,
  KofficeClient,
  sessionKeeper,
  parser
};

export default {
  getKofficeClient,
  clearKofficeClient,
  getAllKofficeClients,
  startSessionKeeper,
  stopSessionKeeper,
  getKeeperStatus,
  KofficeSession,
  KofficeAPI,
  KofficeClient,
  sessionKeeper,
  parser
};
