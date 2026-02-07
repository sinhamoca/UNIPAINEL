// services/gerencia-client.js
// Cliente para interagir com o painel GerenciaApp
// Usando Cloudflare Worker como proxy para bypass de proteção

import axios from 'axios';
import * as db from '../config/database.js';

// URL do Cloudflare Worker
const WORKER_URL = process.env.WORKER_URL || 'https://broken-cake-764a.isaacofc2.workers.dev';

class GerenciaClient {
  constructor(accountId) {
    this.accountId = accountId;
    this.account = null;
    this.cookies = [];
    this.xsrfToken = null;
    this.inertiaVersion = null;
    this.isLoggedIn = false;
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [GerenciaClient:${this.accountId}] [${type}] ${message}`);
  }

  // ==================== INICIALIZAÇÃO ====================

  async init() {
    // Carregar conta do banco
    this.account = db.getGerenciaAccountFull(this.accountId);
    
    if (!this.account) {
      throw new Error('Conta não encontrada');
    }
    
    // Tentar restaurar sessão do banco
    if (this.account.session_cookies && this.account.session_valid_until) {
      const validUntil = new Date(this.account.session_valid_until);
      
      if (validUntil > new Date()) {
        this.log('Tentando restaurar sessão do banco...');
        
        try {
          this.cookies = JSON.parse(this.account.session_cookies);
          this.xsrfToken = this.account.session_xsrf_token;
          this.inertiaVersion = this.account.session_inertia_version;
          
          // Verificar se sessão ainda é válida
          const isValid = await this.checkSession();
          
          if (isValid) {
            this.isLoggedIn = true;
            this.log('✅ Sessão restaurada do banco!');
            return { success: true, cached: true };
          }
          
          this.log('Sessão do banco expirou, fazendo novo login...');
        } catch (error) {
          this.log(`Erro ao restaurar sessão: ${error.message}`, 'WARNING');
        }
      }
    }
    
    // Fazer login fresco
    return await this.login();
  }

  // ==================== HTTP via Worker ====================

  async request(method, path, data = null, extraHeaders = {}) {
    const url = `${this.account.base_url}${path}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      ...extraHeaders
    };

    // Adicionar cookies
    if (this.cookies.length > 0) {
      headers['Cookie'] = this.cookies.join('; ');
    }

    // Adicionar XSRF token
    if (this.xsrfToken) {
      headers['X-XSRF-TOKEN'] = this.xsrfToken;
    }

    // Payload para Worker (mesmo formato do koffice-client)
    const workerPayload = {
      url: url,
      method: method,
      headers: headers
    };

    // Adicionar body se necessário
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      workerPayload.body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await axios.post(WORKER_URL, workerPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      const workerResponse = response.data;

      // Extrair cookies da resposta
      if (workerResponse.headers && workerResponse.headers['set-cookie']) {
        this.parseCookies(workerResponse.headers['set-cookie']);
      }

      // Retornar no formato esperado
      return {
        status: workerResponse.status,
        data: workerResponse.body,
        headers: workerResponse.headers
      };
    } catch (error) {
      this.log(`Erro na requisição: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  parseCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    
    const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    
    for (const cookie of cookieArray) {
      const parts = cookie.split(';')[0]; // Pega só nome=valor
      const [name] = parts.split('=');
      
      // Remove cookie antigo com mesmo nome
      this.cookies = this.cookies.filter(c => !c.startsWith(name + '='));
      
      // Adiciona novo
      this.cookies.push(parts);
      
      // Extrair XSRF token
      if (name === 'XSRF-TOKEN') {
        this.xsrfToken = decodeURIComponent(parts.split('=')[1]);
      }
    }
  }

  // ==================== GERENCIAMENTO DE SESSÃO ====================

  async saveSession() {
    try {
      const validUntil = new Date();
      validUntil.setHours(validUntil.getHours() + 20); // Sessão válida por 20h
      
      db.updateGerenciaSession(this.accountId, {
        cookies: JSON.stringify(this.cookies),
        xsrfToken: this.xsrfToken,
        inertiaVersion: this.inertiaVersion,
        validUntil: validUntil.toISOString()
      });
      
      this.log('Sessão salva no banco');
      return true;
    } catch (error) {
      this.log(`Erro ao salvar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  clearSession() {
    db.clearGerenciaSession(this.accountId);
    this.cookies = [];
    this.xsrfToken = null;
    this.inertiaVersion = null;
    this.isLoggedIn = false;
  }

  extractInertiaVersion(html) {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/version['":\s]+['"]([a-f0-9]+)['"]/);
    if (match) {
      this.inertiaVersion = match[1];
      return this.inertiaVersion;
    }
    return null;
  }

  extractInertiaData(html) {
    if (!html || typeof html !== 'string') return null;
    
    const pageMatch = html.match(/data-page="([^"]+)"/);
    if (pageMatch) {
      try {
        const decoded = pageMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        return JSON.parse(decoded);
      } catch (e) {}
    }
    return null;
  }

  // ==================== AUTENTICAÇÃO ====================

  async checkSession() {
    try {
      this.log('🔍 Verificando sessão...');
      const response = await this.request('GET', '/dashboard');

      if (response.status === 302) {
        const location = response.headers.location || '';
        if (location.includes('login')) {
          this.log('❌ Sessão expirada (redirect para login)');
          return false;
        }
      }

      if (response.status === 200 && typeof response.data === 'string') {
        if (response.data.includes('Dashboard') && !response.data.includes('Login</title>')) {
          this.log('✅ Sessão válida');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.log(`❌ Erro ao verificar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async initSession() {
    try {
      this.log('📡 Inicializando sessão...');
      const response = await this.request('GET', '/');
      
      this.log(`📥 Status: ${response.status}`);
      this.log(`🍪 Cookies: ${this.cookies.length}`);
      this.log(`🔑 XSRF: ${this.xsrfToken ? 'OK' : 'Não encontrado'}`);
      
      this.extractInertiaVersion(response.data);
      
      return this.xsrfToken !== null;
    } catch (error) {
      this.log(`❌ Erro initSession: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async login() {
    try {
      this.log('🔐 Iniciando login...');
      
      // Primeiro, pegar cookies e XSRF token
      const initOk = await this.initSession();
      
      if (!initOk || !this.xsrfToken) {
        this.log('❌ Falha ao obter XSRF token', 'ERROR');
        return { success: false, error: 'Falha ao obter XSRF token' };
      }

      this.log('📤 Enviando credenciais...');
      
      const response = await this.request('POST', '/login', {
        email: this.account.email,
        password: this.account.password,
        remember: true
      }, {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
        'Origin': this.account.base_url,
        'Referer': this.account.base_url + '/'
      });

      this.log(`📥 Resposta: ${response.status}`);

      if (response.status === 302) {
        const location = response.headers.location || '';
        if (location.includes('dashboard')) {
          this.isLoggedIn = true;
          await this.saveSession();
          this.log('✅ Login bem sucedido!');
          
          db.logGerenciaAction(this.accountId, 'login', null, null, 'Login realizado com sucesso');
          
          return { success: true, redirect: location };
        }
      }

      if (response.status === 200) {
        // Verificar se realmente logou
        const checkResponse = await this.request('GET', '/dashboard');
        if (checkResponse.status === 200 && typeof checkResponse.data === 'string') {
          if (checkResponse.data.includes('Dashboard') || checkResponse.data.includes('dashboard')) {
            this.isLoggedIn = true;
            await this.saveSession();
            this.log('✅ Login bem sucedido!');
            
            db.logGerenciaAction(this.accountId, 'login', null, null, 'Login realizado com sucesso');
            
            return { success: true };
          }
        }
      }

      this.log(`❌ Login falhou - status: ${response.status}`, 'ERROR');
      return { success: false, status: response.status, error: 'Credenciais inválidas ou erro no login' };
    } catch (error) {
      this.log(`❌ Erro no login: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  async ensureLoggedIn() {
    if (!this.isLoggedIn) {
      const result = await this.init();
      if (!result.success) {
        throw new Error('Falha na autenticação');
      }
    }
    return true;
  }

  // ==================== PÁGINAS ====================

  async getPage(pagePath) {
    await this.ensureLoggedIn();
    
    try {
      this.log(`📤 getPage: ${pagePath}`);
      
      // IGUAL AO ORIGINAL: sem X-Inertia para sempre receber HTML completo
      const response = await this.request('GET', pagePath, null, {
        'Accept': 'text/html,application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': this.account.base_url + '/'
      });

      this.log(`📥 getPage response status: ${response.status}`);
      this.log(`📥 getPage response type: ${typeof response.data}`);

      if (response.status === 302) {
        const location = response.headers.location;
        this.log(`📥 getPage redirect to: ${location}`);
        if (location && location.includes('login')) {
          this.isLoggedIn = false;
          this.clearSession();
          throw new Error('Sessão expirada');
        }
        if (location && !location.includes('login')) {
          return this.getPage(location.replace(this.account.base_url, ''));
        }
      }

      if (response.status === 200 && typeof response.data === 'string') {
        this.log(`📥 getPage HTML length: ${response.data.length}`);
        
        // Check if it's a login page
        if (response.data.includes('Login</title>') || response.data.includes('login-form')) {
          this.log(`⚠️ getPage: Received login page, session may be invalid`);
          this.isLoggedIn = false;
          this.clearSession();
          throw new Error('Sessão expirada - recebeu página de login');
        }
        
        if (!this.inertiaVersion) {
          this.extractInertiaVersion(response.data);
        }
        const inertiaData = this.extractInertiaData(response.data);
        if (inertiaData) {
          this.log(`✅ getPage: Inertia data extracted, component: ${inertiaData.component || 'unknown'}`);
          return inertiaData;
        }
        this.log(`⚠️ getPage: Could not extract Inertia data, returning raw HTML`);
        return { html: response.data, length: response.data.length };
      }

      // Se a resposta já é JSON (Inertia XHR)
      if (response.status === 200 && typeof response.data === 'object') {
        this.log(`✅ getPage: Direct JSON response, component: ${response.data?.component || 'unknown'}`);
        return response.data;
      }

      this.log(`⚠️ getPage: Unexpected response status ${response.status}`);
      return response.data;
    } catch (error) {
      this.log(`❌ getPage error: ${error.message}`, 'ERROR');
      return { error: error.message };
    }
  }

  // ==================== DASHBOARD ====================

  async getDashboard() {
    return this.getPage('/dashboard');
  }

  // ==================== USUÁRIOS ====================

  async getUsers(page = 1) {
    return this.getPage(`/users?page=${page}`);
  }

  async searchUsers(search, page = 1) {
    return this.getPage(`/users?search=${encodeURIComponent(search)}&page=${page}`);
  }

  async findUser(search) {
    const result = await this.searchUsers(search, 1);
    if (result?.props?.users) {
      const users = result.props.users.data || result.props.users;
      if (Array.isArray(users) && users.length > 0) {
        // Atualizar cache
        for (const user of users) {
          db.upsertGerenciaUserCache(this.accountId, user);
        }
        return users[0];
      }
    }
    return null;
  }

  async getUserById(userId) {
    // Primeiro tentar do cache
    const cached = db.getGerenciaUserCacheById(this.accountId, userId);
    if (cached) {
      this.log(`📋 Usuário ${userId} encontrado no cache`);
      return JSON.parse(cached.raw_data);
    }
    
    // Se não está no cache, buscar direto da página de edição
    this.log(`📋 Usuário ${userId} não está no cache, buscando na página de edição...`);
    
    try {
      await this.ensureLoggedIn();
      
      // Acessar página de edição diretamente - SEM X-Inertia para evitar erro 409
      const editUrl = `/users/${userId}/edit`;
      const response = await this.request('GET', editUrl, null, {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': this.account.base_url + '/users'
      });
      
      // Verificar se foi redirecionado para login ou página não encontrada
      if (response.status === 404 || response.status === 403) {
        this.log(`📋 Usuário ${userId} não encontrado (${response.status})`, 'WARN');
        return null;
      }
      
      // Tentar extrair dados do Inertia
      let pageData = null;
      
      if (response.data && typeof response.data === 'object') {
        pageData = response.data;
      } else if (typeof response.data === 'string') {
        // Tentar extrair do HTML
        const dataMatch = response.data.match(/data-page="([^"]+)"/);
        if (dataMatch) {
          try {
            const decoded = dataMatch[1].replace(/&quot;/g, '"');
            pageData = JSON.parse(decoded);
          } catch (e) {
            // Tentar outro padrão
          }
        }
      }
      
      if (pageData?.props?.user) {
        const user = pageData.props.user;
        this.log(`📋 Usuário ${userId} encontrado na página de edição: ${user.server_name}`);
        db.upsertGerenciaUserCache(this.accountId, user);
        return user;
      }
      
      this.log(`📋 Não foi possível extrair dados do usuário ${userId}`, 'WARN');
      return null;
      
    } catch (error) {
      this.log(`📋 Erro ao buscar usuário ${userId}: ${error.message}`, 'ERROR');
      return null;
    }
  }

  // ==================== CRIAR USUÁRIO ====================

  async createUser({ mac_device, server_name, m3u8_list, expire_date, dns, whatsapp }) {
    await this.ensureLoggedIn();

    if (!expire_date) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      expire_date = nextYear.toISOString().split('T')[0];
    }

    const payload = {
      modo_selecao: 1,
      mac_device: mac_device || '00:00:00:00:00:00',
      server_name: server_name || 'Novo Usuario',
      account_username: '',
      account_password: '',
      xteam_username: '',
      xteam_password: '',
      dns: dns || '',
      dnsOptions: '',
      m3u8_list: m3u8_list || '',
      url_epg: '',
      price: '',
      ranking_app_id: '',
      plan_id: '',
      expire_date: expire_date,
      whatsapp: whatsapp || ''
    };

    try {
      const response = await this.request('POST', '/users', payload, {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
        'X-Inertia-Version': this.inertiaVersion || '',
        'Origin': this.account.base_url,
        'Referer': `${this.account.base_url}/users`
      });

      if (response.status === 302 || response.status === 200) {
        db.logGerenciaAction(
          this.accountId, 
          'create_user', 
          null, 
          server_name, 
          `MAC: ${mac_device}, Validade: ${expire_date}`
        );
        
        return { 
          success: true,
          user: {
            server_name: payload.server_name,
            mac_device: payload.mac_device,
            m3u8_list: payload.m3u8_list,
            expire_date: payload.expire_date
          }
        };
      }

      if (response.status === 422) {
        return { success: false, errors: response.data, status: 422 };
      }

      return { success: false, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== EDITAR USUÁRIO ====================

  async updateUser(userId, updateData) {
    await this.ensureLoggedIn();

    try {
      const response = await this.request('POST', `/users/${userId}`, updateData, {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
        'X-Inertia-Version': this.inertiaVersion || '',
        'Origin': this.account.base_url,
        'Referer': `${this.account.base_url}/users`
      });

      if (response.status === 302 || response.status === 200) {
        return { success: true, status: response.status };
      }

      if (response.status === 422) {
        return { success: false, errors: response.data, status: 422 };
      }

      return { success: false, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async editUser(search, newData) {
    const user = await this.findUser(search);
    
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const payload = {
      modo_selecao: user.modo_selecao || 1,
      mac_device: newData.mac_device ?? user.mac_device,
      server_name: newData.server_name ?? user.server_name,
      account_username: user.email || '',
      account_password: '',
      xteam_username: user.xteam_username || null,
      xteam_password: user.xteam_password || null,
      dns: newData.dns ?? user.dns,
      m3u8_list: newData.m3u8_list ?? user.m3u8_list,
      url_epg: user.url_epg || null,
      price: user.price || null,
      ranking_app_id: undefined,
      plan_id: user.plan_id || null,
      expire_date: newData.expire_date ?? user.expire_account
    };

    const result = await this.updateUser(user.id, payload);
    
    if (result.success) {
      // Atualizar cache
      const updatedUser = { ...user, ...payload };
      db.upsertGerenciaUserCache(this.accountId, updatedUser);
      
      db.logGerenciaAction(
        this.accountId, 
        'edit_user', 
        user.id, 
        user.server_name, 
        `Campos alterados: ${Object.keys(newData).join(', ')}`
      );
      
      return { 
        success: true, 
        user: {
          id: user.id,
          name: payload.server_name,
          mac_device: payload.mac_device,
          m3u8_list: payload.m3u8_list,
          expire_date: payload.expire_date
        }
      };
    }

    return result;
  }

  // ==================== RENOVAR USUÁRIO ====================

  async renewUser(userId, days) {
    const user = await this.getUserById(userId);
    
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    // Calcular nova data de expiração
    const currentExp = user.expire_date || user.expire_account 
      ? new Date(user.expire_date || user.expire_account) 
      : new Date();
    
    // Se já expirou, começar de hoje
    if (currentExp < new Date()) {
      currentExp.setTime(Date.now());
    }
    
    currentExp.setDate(currentExp.getDate() + days);
    const newExpireDate = currentExp.toISOString().split('T')[0];

    const payload = {
      modo_selecao: user.modo_selecao || 1,
      mac_device: user.mac_device,
      server_name: user.server_name,
      account_username: user.email || '',
      account_password: '',
      xteam_username: user.xteam_username || null,
      xteam_password: user.xteam_password || null,
      dns: user.dns || null,
      m3u8_list: user.m3u8_list,
      url_epg: user.url_epg || null,
      price: user.price || null,
      ranking_app_id: undefined,
      plan_id: user.plan_id || null,
      expire_date: newExpireDate
    };

    const result = await this.updateUser(user.id, payload);
    
    if (result.success) {
      // Atualizar cache
      user.expire_date = newExpireDate;
      user.expire_account = newExpireDate;
      db.upsertGerenciaUserCache(this.accountId, user);
      
      db.logGerenciaAction(
        this.accountId, 
        'renew_user', 
        user.id, 
        user.server_name, 
        `+${days} dias, nova validade: ${newExpireDate}`
      );
      
      return { 
        success: true, 
        user: {
          id: user.id,
          name: user.server_name,
          newExpireDate
        }
      };
    }

    return result;
  }

  // ==================== DELETAR USUÁRIO ====================

  async deleteUserById(userId) {
    await this.ensureLoggedIn();

    try {
      const response = await this.request('DELETE', `/users/${userId}`, null, {
        'Accept': 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': this.account.base_url,
        'Referer': `${this.account.base_url}/users`
      });

      if (response.status === 200) {
        // Remover do cache
        db.deleteGerenciaUserCache(this.accountId, userId);
        
        return { success: true, message: response.data?.message || 'Usuário excluído' };
      }

      return { success: false, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteUser(search) {
    const user = await this.findUser(search);
    
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const result = await this.deleteUserById(user.id);
    
    if (result.success) {
      db.logGerenciaAction(
        this.accountId, 
        'delete_user', 
        user.id, 
        user.server_name, 
        `MAC: ${user.mac_device}`
      );
    }
    
    result.user = user;
    return result;
  }

  // ==================== SINCRONIZAR CACHE ====================

  async syncCache(pages = 5) {
    this.log(`Sincronizando cache (${pages} páginas)...`);
    
    let totalUsers = 0;
    
    for (let page = 1; page <= pages; page++) {
      const result = await this.getUsers(page);
      
      // DEBUG: mostrar o que está vindo
      this.log(`[DEBUG] Página ${page} - result type: ${typeof result}`);
      if (result) {
        this.log(`[DEBUG] Página ${page} - result keys: ${Object.keys(result).join(', ')}`);
        if (result.props) {
          this.log(`[DEBUG] Página ${page} - props keys: ${Object.keys(result.props).join(', ')}`);
        }
        if (result.error) {
          this.log(`[DEBUG] Página ${page} - error: ${result.error}`, 'ERROR');
        }
        if (result.html) {
          this.log(`[DEBUG] Página ${page} - HTML length: ${result.html?.length || 0}`);
        }
      }
      
      if (result?.props?.users) {
        const users = result.props.users.data || result.props.users;
        
        this.log(`[DEBUG] Página ${page} - users type: ${typeof users}, isArray: ${Array.isArray(users)}, length: ${users?.length || 0}`);
        
        if (!Array.isArray(users) || users.length === 0) {
          break;
        }
        
        for (const user of users) {
          db.upsertGerenciaUserCache(this.accountId, user);
          totalUsers++;
        }
        
        // Se a página não está cheia, é a última
        if (users.length < 15) {
          break;
        }
      } else {
        this.log(`[DEBUG] Página ${page} - result.props.users não existe, saindo do loop`);
        break;
      }
    }
    
    this.log(`✅ Cache sincronizado: ${totalUsers} usuários`);
    
    db.logGerenciaAction(
      this.accountId, 
      'sync_cache', 
      null, 
      null, 
      `${totalUsers} usuários sincronizados`
    );
    
    return { success: true, totalUsers };
  }
}

// Mapa de instâncias ativas (para manter sessões em memória)
const activeClients = new Map();

export function getGerenciaClient(accountId) {
  if (!activeClients.has(accountId)) {
    activeClients.set(accountId, new GerenciaClient(accountId));
  }
  return activeClients.get(accountId);
}

export function clearGerenciaClient(accountId) {
  if (activeClients.has(accountId)) {
    activeClients.delete(accountId);
  }
}

export default GerenciaClient;