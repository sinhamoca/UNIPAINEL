// =============================================
// Koffice Client Service
// Gerencia sessão e operações com painel Koffice
// =============================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import { updateKofficeSession } from '../config/database.js';

// Worker URL para bypass do Cloudflare
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://broken-cake-764a.isaacofc2.workers.dev';

// Anti-Captcha API Key - lida dinamicamente para garantir que .env foi carregado
function getAntiCaptchaKey() {
  const key = process.env.ANTICAPTCHA_KEY || '';
  if (!key) {
    console.log('[KOFFICE] ANTICAPTCHA_KEY não encontrada. Variáveis disponíveis:', Object.keys(process.env).filter(k => k.includes('ANTI') || k.includes('CAPTCHA')));
  }
  return key;
}

class KofficeClient {
  constructor(account) {
    this.account = account;
    this.accountId = account.id;
    this.domain = account.domain.replace(/\/$/, '');
    this.cookies = {};
    this.loggedIn = false;
    this.loginCount = 0;
    this.lastSessionCheck = 0; // Timestamp da última verificação de sessão
    this.sessionStartTime = null; // Quando a sessão foi iniciada
  }

  // =============================================
  // LOGGING
  // =============================================
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KofficeClient:${this.account.id}] [${level}] ${message}`);
  }

  // =============================================
  // HTTP REQUEST VIA WORKER
  // =============================================
  async request(method, path, data = null, extraHeaders = {}) {
    const url = path.startsWith('http') ? path : `${this.domain}${path}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      ...extraHeaders
    };

    // Adicionar cookies
    const cookieString = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    // Payload para Worker
    const workerPayload = {
      url: url,
      method: method,
      headers: headers
    };

    // Adicionar body se necessário
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (typeof data === 'string') {
        workerPayload.body = data;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        workerPayload.body = JSON.stringify(data);
        headers['Content-Type'] = 'application/json';
      }
    }

    try {
      const response = await axios.post(WORKER_URL, workerPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });

      const workerResponse = response.data;

      // Processar cookies da resposta
      if (workerResponse.headers && workerResponse.headers['set-cookie']) {
        this.parseCookies(workerResponse.headers['set-cookie']);
      }

      return {
        status: workerResponse.status,
        data: workerResponse.body,
        headers: workerResponse.headers
      };
    } catch (error) {
      this.log(`Request error: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // =============================================
  // PARSE COOKIES
  // =============================================
  parseCookies(setCookieArray) {
    const cookies = Array.isArray(setCookieArray) ? setCookieArray : [setCookieArray];
    
    for (const cookie of cookies) {
      if (!cookie) continue;
      const parts = cookie.split(';')[0];
      const eqIndex = parts.indexOf('=');
      if (eqIndex > 0) {
        const name = parts.substring(0, eqIndex);
        const value = parts.substring(eqIndex + 1);
        this.cookies[name] = value;
      }
    }
  }

  // =============================================
  // GET CSRF TOKEN
  // =============================================
  async getCsrfToken() {
    this.log('Obtendo CSRF token...');
    
    const response = await this.request('GET', '/login/');
    
    if (response.status !== 200) {
      throw new Error(`Falha ao acessar página de login: HTTP ${response.status}`);
    }

    const $ = cheerio.load(response.data);
    const csrfToken = $('input[name="csrf_token"]').val();
    const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || $('[data-sitekey]').attr('data-sitekey');

    if (!csrfToken) {
      throw new Error('CSRF Token não encontrado na página de login');
    }

    this.log(`CSRF obtido. hCaptcha: ${hcaptchaSiteKey ? 'SIM' : 'NÃO'}`);

    return {
      csrfToken,
      hasHCaptcha: !!hcaptchaSiteKey,
      hcaptchaSiteKey
    };
  }

  // =============================================
  // SOLVE HCAPTCHA
  // =============================================
  async solveHCaptcha(siteKey) {
    const antiCaptchaKey = getAntiCaptchaKey();
    
    if (!antiCaptchaKey) {
      throw new Error('Anti-Captcha API Key não configurada. Configure ANTICAPTCHA_KEY no .env');
    }

    this.log('Resolvendo hCaptcha via Anti-Captcha...');

    // Criar task
    const createTask = await axios.post('https://api.anti-captcha.com/createTask', {
      clientKey: antiCaptchaKey,
      task: {
        type: 'HCaptchaTaskProxyless',
        websiteURL: `${this.domain}/login/`,
        websiteKey: siteKey
      }
    }, { timeout: 30000 });

    if (createTask.data.errorId !== 0) {
      throw new Error(`Anti-Captcha erro: ${createTask.data.errorDescription}`);
    }

    const taskId = createTask.data.taskId;
    this.log(`Task Anti-Captcha criada: ${taskId}`);

    // Aguardar resultado (máx 3 minutos)
    for (let i = 0; i < 60; i++) {
      await this.delay(3000);

      const result = await axios.post('https://api.anti-captcha.com/getTaskResult', {
        clientKey: antiCaptchaKey,
        taskId
      }, { timeout: 30000 });

      if ((i + 1) % 10 === 0) {
        this.log(`Aguardando captcha... ${(i + 1) * 3}s`);
      }

      if (result.data.status === 'ready') {
        this.log(`hCaptcha resolvido em ${(i + 1) * 3}s!`);
        return result.data.solution.gRecaptchaResponse;
      }

      if (result.data.errorId !== 0) {
        throw new Error(`Anti-Captcha erro: ${result.data.errorDescription}`);
      }
    }

    throw new Error('Timeout resolvendo captcha (3 min)');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================
  // LOGIN
  // =============================================
  async login() {
    this.log('Iniciando login...');
    const startTime = Date.now();

    try {
      // 1. Obter CSRF e detectar captcha
      const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();

      // 2. Resolver captcha se necessário
      let captchaToken = null;
      if (hasHCaptcha && this.account.has_captcha) {
        captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
      }

      // 3. Preparar payload de login
      const payload = new URLSearchParams({
        try_login: '1',
        csrf_token: csrfToken,
        username: this.account.username,
        password: this.account.password
      });

      if (captchaToken) {
        payload.append('g-recaptcha-response', captchaToken);
        payload.append('h-captcha-response', captchaToken);
      }

      // 4. Fazer login
      const loginResponse = await this.request('POST', '/login/', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/login/`
      });

      // 5. Seguir redirects se necessário
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const location = loginResponse.headers.location || loginResponse.headers.Location;
        if (location && location.includes('login')) {
          throw new Error('Credenciais inválidas');
        }
        
        // Fazer GET na nova localização
        const redirectPath = location.startsWith('http') ? location : location;
        const redirectResponse = await this.request('GET', redirectPath);
        
        // Verificar se logou
        const html = redirectResponse.data;
        if (html.includes('logout') || html.includes('sair') || html.includes('dashboard')) {
          this.loggedIn = true;
        }
      } else if (loginResponse.status === 200) {
        const html = loginResponse.data;
        if (html.includes('logout') || html.includes('sair') || html.includes('dashboard')) {
          this.loggedIn = true;
        } else if (html.includes('csrf_token') && html.includes('try_login')) {
          throw new Error('Credenciais inválidas');
        }
      }

      if (!this.loggedIn) {
        // Tentar verificar sessão
        const checkResponse = await this.request('GET', '/clients/');
        const checkHtml = checkResponse.data;
        
        if (checkHtml.includes('logout') || checkHtml.includes('sair')) {
          this.loggedIn = true;
        }
      }

      if (!this.loggedIn) {
        throw new Error('Não foi possível validar o login');
      }

      this.loginCount++;
      this.sessionStartTime = Date.now();
      this.lastSessionCheck = Date.now();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.log(`LOGIN #${this.loginCount} OK em ${elapsed}s`);

      // Salvar sessão no banco
      await this.saveSession();

      return true;
    } catch (error) {
      this.log(`Erro no login: ${error.message}`, 'ERROR');
      this.loggedIn = false;
      throw error;
    }
  }

  // =============================================
  // SAVE SESSION
  // =============================================
  async saveSession() {
    const cookiesJson = JSON.stringify(this.cookies);
    const validUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 horas

    updateKofficeSession(this.account.id, {
      cookies: cookiesJson,
      validUntil: validUntil
    });

    this.log('Sessão salva no banco');
  }

  // =============================================
  // RESTORE SESSION
  // =============================================
  async restoreSession() {
    if (!this.account.session_cookies || !this.account.session_valid_until) {
      return false;
    }

    // Verificar se sessão ainda é válida
    const validUntil = new Date(this.account.session_valid_until);
    if (validUntil < new Date()) {
      this.log('Sessão expirada');
      return false;
    }

    try {
      this.cookies = JSON.parse(this.account.session_cookies);
      
      // Verificar se sessão ainda funciona
      const response = await this.request('GET', '/clients/', null, {
        'X-Requested-With': 'XMLHttpRequest'
      });

      const html = response.data;
      const hasLoginForm = html.includes('csrf_token') && html.includes('try_login');

      if (hasLoginForm || response.status !== 200) {
        this.log('Sessão inválida');
        return false;
      }

      if (html.includes('logout') || html.includes('sair')) {
        this.loggedIn = true;
        this.lastSessionCheck = Date.now();
        this.log('Sessão restaurada do banco!');
        return true;
      }

      return false;
    } catch (error) {
      this.log(`Erro ao restaurar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // =============================================
  // ENSURE LOGGED IN (igual ao projeto original)
  // =============================================
  async ensureLoggedIn() {
    // Se nunca logou ou não tem cookies, fazer login
    if (!this.loggedIn || Object.keys(this.cookies).length === 0) {
      this.log('Sessão não iniciada, fazendo login...');
      
      // Tentar restaurar sessão do banco primeiro
      const restored = await this.restoreSession();
      if (restored) {
        // Verificar se sessão restaurada ainda está ativa
        const isActive = await this.checkSession();
        if (isActive) {
          this.log('Sessão restaurada e verificada!');
          return true;
        }
        this.log('Sessão restaurada expirou, fazendo novo login...');
      }
      
      // Fazer novo login
      return await this.login();
    }
    
    // Já está logado, mas verificar se sessão ainda está ativa
    // (verificar a cada 5 minutos para não sobrecarregar)
    const now = Date.now();
    const lastCheck = this.lastSessionCheck || 0;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (now - lastCheck > fiveMinutes) {
      this.log('Verificando se sessão ainda está ativa...');
      const isActive = await this.checkSession();
      this.lastSessionCheck = now;
      
      if (!isActive) {
        this.log('Sessão expirou, re-logando...', 'WARN');
        this.loggedIn = false;
        return await this.login();
      }
    }
    
    return true;
  }

  // =============================================
  // CHECK SESSION (melhorado)
  // =============================================
  async checkSession() {
    try {
      const response = await this.request('GET', '/clients/');
      const html = response.data;
      
      // Verificar se foi redirecionado para login
      const hasLoginForm = html.includes('csrf_token') && html.includes('try_login');
      
      if (hasLoginForm) {
        this.log('Sessão expirou (página de login detectada)', 'WARN');
        this.loggedIn = false;
        return false;
      }
      
      // Verificar se tem elementos de usuário logado
      const isLoggedIn = html.includes('logout') || html.includes('sair') || html.includes('dashboard');
      
      if (isLoggedIn) {
        return true;
      }
      
      // Se não tem login form mas também não tem logout, verificar status
      return response.status === 200 && !hasLoginForm;
      
    } catch (error) {
      this.log(`Erro ao verificar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // =============================================
  // SEARCH CLIENTS
  // =============================================
  async searchClients(searchTerm, limit = 20) {
    await this.ensureLoggedIn();

    this.log(`Buscando clientes: "${searchTerm}"`);

    try {
      // Montar payload DataTables
      const payload = new URLSearchParams();
      payload.append('get_clients', '');
      payload.append('draw', '1');
      payload.append('start', '0');
      payload.append('length', limit.toString());
      payload.append('search[value]', searchTerm);
      payload.append('search[regex]', 'false');
      payload.append('order[0][column]', '0');
      payload.append('order[0][dir]', 'desc');
      payload.append('filter_value', '#');
      payload.append('reseller_id', '-1');

      // Adicionar colunas (0-9)
      for (let i = 0; i < 10; i++) {
        payload.append(`columns[${i}][data]`, i.toString());
        payload.append(`columns[${i}][name]`, '');
        payload.append(`columns[${i}][searchable]`, 'true');
        payload.append(`columns[${i}][orderable]`, 'true');
        payload.append(`columns[${i}][search][value]`, '');
        payload.append(`columns[${i}][search][regex]`, 'false');
      }

      const response = await this.request('POST', '/clients/api/?get_clients', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/clients/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      // Verificar se sessão expirou
      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.log('Sessão expirou, re-logando...', 'WARNING');
        this.loggedIn = false;
        await this.login();
        return await this.searchClients(searchTerm, limit);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida da API');
      }

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Resposta inválida da API');
      }

      // Parsear clientes
      const clients = data.data.map(row => this.parseClientRow(row));

      this.log(`Encontrados ${clients.length} clientes`);

      return {
        success: true,
        total: data.recordsFiltered || clients.length,
        clients
      };
    } catch (error) {
      this.log(`Erro ao buscar clientes: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
        clients: []
      };
    }
  }

  // =============================================
  // PARSE CLIENT ROW
  // =============================================
  parseClientRow(row) {
    // row[0] = ID do cliente
    // row[1] = Usuário (pode ter HTML)
    // row[2] = Senha
    // row[3] = Data de criação
    // row[4] = Validade
    // row[5] = Revendedor
    // row[6] = Telas
    // row[7] = Nome (HTML)
    // row[8] = Status (HTML)

    const stripHtml = (str) => {
      if (!str) return '';
      return str.replace(/<[^>]+>/g, '').trim();
    };

    // Extrair nome do HTML
    let name = row[7] || '';
    const nameMatch = name.match(/data-original-title="([^"]+)"/);
    if (nameMatch) {
      name = nameMatch[1];
    } else {
      name = stripHtml(name);
    }

    // Extrair username
    let username = row[1] || '';
    username = stripHtml(username);

    // Extrair status do HTML
    let status = row[8] || '';
    if (status.includes('badge-success')) {
      status = 'Ativo';
    } else if (status.includes('badge-danger')) {
      status = 'Bloqueado';
    } else if (status.includes('badge-warning')) {
      status = 'Expirado';
    } else {
      status = stripHtml(status) || 'Desconhecido';
    }

    return {
      id: row[0],
      username: username,
      password: row[2],
      createdAt: row[3],
      expiresAt: row[4],
      reseller: row[5],
      screens: row[6],
      name: name,
      status: status
    };
  }

  // =============================================
  // GET CLIENTS (PAGINATED)
  // =============================================
  async getClients(page = 1, perPage = 20) {
    await this.ensureLoggedIn();

    const start = (page - 1) * perPage;

    try {
      const payload = new URLSearchParams();
      payload.append('get_clients', '');
      payload.append('draw', page.toString());
      payload.append('start', start.toString());
      payload.append('length', perPage.toString());
      payload.append('search[value]', '');
      payload.append('search[regex]', 'false');
      payload.append('order[0][column]', '0');
      payload.append('order[0][dir]', 'desc');
      payload.append('filter_value', '#');
      payload.append('reseller_id', '-1');

      for (let i = 0; i < 10; i++) {
        payload.append(`columns[${i}][data]`, i.toString());
        payload.append(`columns[${i}][name]`, '');
        payload.append(`columns[${i}][searchable]`, 'true');
        payload.append(`columns[${i}][orderable]`, 'true');
        payload.append(`columns[${i}][search][value]`, '');
        payload.append(`columns[${i}][search][regex]`, 'false');
      }

      const response = await this.request('POST', '/clients/api/?get_clients', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/clients/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.getClients(page, perPage);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (!data.data || !Array.isArray(data.data)) {
        return { success: true, clients: [], pagination: null };
      }

      const clients = data.data.map(row => this.parseClientRow(row));
      const total = data.recordsFiltered || data.recordsTotal || 0;

      return {
        success: true,
        clients,
        pagination: {
          currentPage: page,
          perPage,
          total,
          lastPage: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      this.log(`Erro ao listar clientes: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, clients: [] };
    }
  }

  // =============================================
  // RENEW CLIENT
  // =============================================
  async renewClient(clientId, months) {
    await this.ensureLoggedIn();

    this.log(`Renovando cliente ${clientId} por ${months} mês(es)...`);

    try {
      const response = await this.request(
        'POST',
        `/clients/api/?renew_client_plus&client_id=${clientId}&months=${months}`,
        '',
        {
          'Referer': `${this.domain}/clients/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      );

      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.renewClient(clientId, months);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        data = { result: response.data };
      }

      if (data.result === 'success') {
        this.log(`Cliente ${clientId} renovado!`);
        return { success: true, clientId, months };
      }

      if (data.result === 'failed') {
        throw new Error(data.msg || 'Falha na renovação');
      }

      // Verificar resposta string
      if (typeof response.data === 'string') {
        const lower = response.data.toLowerCase();
        if (lower.includes('success') || lower === 'ok') {
          return { success: true, clientId, months };
        }
      }

      throw new Error('Resposta inesperada');
    } catch (error) {
      this.log(`Erro ao renovar: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // CREATE FAST TEST
  // =============================================
  async createFastTest() {
    await this.ensureLoggedIn();

    this.log('Criando teste rápido...');

    try {
      const payload = new URLSearchParams();
      payload.append('fast_test', '');

      const response = await this.request('POST', '/dashboard/api/?fast_test', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/dashboard/`,
        'Origin': this.domain,
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.createFastTest();
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log('Teste criado!');

        const message = data.message || '';
        const userMatch = message.match(/User:\s*(\d+)/);
        const passMatch = message.match(/Password:\s*(\d+)/);
        const validMatch = message.match(/Valid Until:\s*([^\<]+)/);
        const ssMatch = message.match(/SS:\s*(http[^\<\s]+)/);
        const m3uMatch = message.match(/M3U:\s*(http[^\<\s]+)/);

        return {
          success: true,
          user: userMatch ? userMatch[1] : null,
          password: passMatch ? passMatch[1] : null,
          validUntil: validMatch ? validMatch[1].trim() : null,
          shortUrl: ssMatch ? ssMatch[1].trim() : null,
          m3uUrl: m3uMatch ? m3uMatch[1].trim() : null,
          rawMessage: message
        };
      }

      throw new Error(data.msg || 'Falha ao criar teste');
    } catch (error) {
      this.log(`Erro ao criar teste: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // GET CLIENT FAST MESSAGE (DADOS DO CLIENTE)
  // =============================================
  async getClientFastMessage(clientId) {
    await this.ensureLoggedIn();

    this.log(`Obtendo dados do cliente ${clientId}...`);

    try {
      const payload = new URLSearchParams();
      payload.append('fast_message', '');
      payload.append('client_id', clientId);

      const response = await this.request(
        'POST',
        `/clients/api/?fast_message&client_id=${clientId}`,
        payload.toString(),
        {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.domain}/clients/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      );

      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.getClientFastMessage(clientId);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log('Dados do cliente obtidos!');

        const message = data.message || '';
        
        // Extrair dados
        const userMatch = message.match(/User:\s*\*?\s*(\d+)/);
        const passMatch = message.match(/Password:\s*\*?\s*(\d+)/);
        const validMatch = message.match(/Valid Until:\s*\*?\s*([^\<\n]+)/);
        const ssMatch = message.match(/SS:\s*\*?\s*(http[^\<\s]+)/);
        const m3uMatch = message.match(/TS\s*-?\s*(http[^\<\n]+)/);

        return {
          success: true,
          clientId,
          user: userMatch ? userMatch[1] : null,
          password: passMatch ? passMatch[1] : null,
          validUntil: validMatch ? validMatch[1].trim() : null,
          shortUrl: ssMatch ? ssMatch[1].trim() : null,
          m3uUrl: m3uMatch ? m3uMatch[1].trim() : null,
          rawMessage: message
        };
      }

      throw new Error(data.msg || 'Falha ao obter dados');
    } catch (error) {
      this.log(`Erro ao obter dados: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // RESET CLIENT ATTRIBUTE (username/password)
  // =============================================
  async resetClientAttribute(clientId, attribute) {
    await this.ensureLoggedIn();

    this.log(`Resetando ${attribute} do cliente ${clientId}...`);

    try {
      const payload = new URLSearchParams();
      payload.append('reset', '');
      payload.append('client_id', clientId);
      payload.append('attribute', attribute);

      const response = await this.request(
        'POST',
        `/clients/api/?reset&client_id=${clientId}&attribute=${attribute}`,
        payload.toString(),
        {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.domain}/clients/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      );

      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.resetClientAttribute(clientId, attribute);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log(`${attribute} resetado: ${data.attribute_value}`);
        return {
          success: true,
          attribute,
          newValue: data.attribute_value
        };
      }

      throw new Error(`Falha ao resetar ${attribute}`);
    } catch (error) {
      this.log(`Erro ao resetar ${attribute}: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // EDIT CLIENT NOTES (nome)
  // =============================================
  async editClientNotes(clientId, notes) {
    await this.ensureLoggedIn();

    this.log(`Editando notas do cliente ${clientId}...`);

    try {
      const payload = new URLSearchParams();
      payload.append('action', 'edit_client');
      payload.append('client_id', clientId);
      payload.append('email', '');
      payload.append('phone_number', '');
      payload.append('reseller_notes', notes);
      // Bouquets padrão
      payload.append('bouquets[]', '1');
      payload.append('bouquets[]', '2');
      payload.append('bouquets[]', '3');
      payload.append('bouquets[]', '4');

      const response = await this.request(
        'POST',
        `/clients/edit/${clientId}/`,
        payload.toString(),
        {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.domain}/clients/edit/${clientId}/`,
          'Origin': this.domain
        }
      );

      // 302 redirect ou 200 significa sucesso
      if (response.status === 302 || response.status === 200) {
        this.log(`Notas atualizadas para: ${notes}`);
        return { success: true, clientId, notes };
      }

      throw new Error('Falha ao editar notas');
    } catch (error) {
      // Axios trata redirect como erro se maxRedirects: 0
      if (error.response && error.response.status === 302) {
        return { success: true, clientId, notes };
      }

      this.log(`Erro ao editar notas: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // REVENDAS (RESELLERS) - Via DataTables AJAX API
  // =============================================

  async getResellers(page = 1, perPage = 20) {
    try {
      await this.ensureLoggedIn();

      this.log(`Buscando revendas via API - página ${page}, perPage ${perPage}`);

      // Calcular offset para DataTables (start = (page-1) * perPage)
      const start = (page - 1) * perPage;

      // Payload DataTables padrão
      const payload = new URLSearchParams();
      payload.append('get_resellers', '');
      payload.append('draw', '1');
      payload.append('start', start.toString());
      payload.append('length', perPage.toString());
      payload.append('search[value]', '');
      payload.append('search[regex]', 'false');
      payload.append('order[0][column]', '0');
      payload.append('order[0][dir]', 'desc');
      
      // Colunas (necessário para DataTables)
      for (let i = 0; i < 10; i++) {
        payload.append(`columns[${i}][data]`, i.toString());
        payload.append(`columns[${i}][name]`, '');
        payload.append(`columns[${i}][searchable]`, 'true');
        payload.append(`columns[${i}][orderable]`, 'true');
        payload.append(`columns[${i}][search][value]`, '');
        payload.append(`columns[${i}][search][regex]`, 'false');
      }

      const response = await this.request('POST', '/resellers/api/?get_resellers', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      });

      // Parse JSON response
      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        this.log(`Erro ao parsear JSON: ${e.message}`, 'ERROR');
        this.log(`Response data: ${JSON.stringify(response.data).substring(0, 500)}`, 'DEBUG');
        return { success: false, error: 'Resposta inválida da API', resellers: [] };
      }

      this.log(`API retornou: recordsTotal=${data.recordsTotal}, recordsFiltered=${data.recordsFiltered}, data.length=${data.data?.length || 0}`);

      const resellers = [];

      if (data.data && Array.isArray(data.data)) {
        for (const row of data.data) {
          // Estrutura: [ID, Username, Email, Expiry, IP, Credits, Notes, Owner, StatusHTML, ActionsHTML]
          const id = row[0] || '';
          const username = row[1] || '';
          const email = row[2] || '';
          const expiry = row[3] || '';
          const ip = row[4] || '';
          const credits = parseInt(row[5]) || 0;
          const notes = row[6] || '';
          const owner = row[7] || '';
          const statusHtml = row[8] || '';
          
          // Extrair status do HTML
          let status = 'active';
          if (statusHtml.toLowerCase().includes('danger') || 
              statusHtml.toLowerCase().includes('inativo') ||
              statusHtml.toLowerCase().includes('inactive') ||
              statusHtml.toLowerCase().includes('bloqueado') ||
              statusHtml.toLowerCase().includes('blocked')) {
            status = 'inactive';
          }

          if (id && username) {
            resellers.push({
              id,
              username,
              email,
              name: notes || username,
              credits,
              expiry,
              ip,
              owner,
              status
            });
          }
        }
      }

      // Calcular paginação
      const totalRecords = data.recordsFiltered || data.recordsTotal || 0;
      const totalPages = Math.ceil(totalRecords / perPage);

      this.log(`Total de revendas encontradas: ${resellers.length}`);

      return {
        success: true,
        resellers,
        pagination: {
          page,
          perPage,
          totalRecords,
          totalPages,
          hasMore: page < totalPages
        }
      };
    } catch (error) {
      this.log(`Erro ao buscar revendas: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, resellers: [] };
    }
  }

  async searchResellers(searchTerm, limit = 20) {
    try {
      await this.ensureLoggedIn();

      this.log(`Buscando revendas com termo: ${searchTerm}`);

      // Payload DataTables com busca
      const payload = new URLSearchParams();
      payload.append('get_resellers', '');
      payload.append('draw', '1');
      payload.append('start', '0');
      payload.append('length', limit.toString());
      payload.append('search[value]', searchTerm);
      payload.append('search[regex]', 'false');
      payload.append('order[0][column]', '0');
      payload.append('order[0][dir]', 'desc');
      
      // Colunas
      for (let i = 0; i < 10; i++) {
        payload.append(`columns[${i}][data]`, i.toString());
        payload.append(`columns[${i}][name]`, '');
        payload.append(`columns[${i}][searchable]`, 'true');
        payload.append(`columns[${i}][orderable]`, 'true');
        payload.append(`columns[${i}][search][value]`, '');
        payload.append(`columns[${i}][search][regex]`, 'false');
      }

      const response = await this.request('POST', '/resellers/api/?get_resellers', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      });

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        this.log(`Erro ao parsear JSON: ${e.message}`, 'ERROR');
        return { success: false, error: 'Resposta inválida da API', resellers: [] };
      }

      this.log(`Busca retornou: ${data.data?.length || 0} resultados de ${data.recordsFiltered || 0} filtrados`);

      const resellers = [];

      if (data.data && Array.isArray(data.data)) {
        for (const row of data.data) {
          const id = row[0] || '';
          const username = row[1] || '';
          const email = row[2] || '';
          const expiry = row[3] || '';
          const ip = row[4] || '';
          const credits = parseInt(row[5]) || 0;
          const notes = row[6] || '';
          const owner = row[7] || '';
          const statusHtml = row[8] || '';
          
          let status = 'active';
          if (statusHtml.toLowerCase().includes('danger') || 
              statusHtml.toLowerCase().includes('inativo') ||
              statusHtml.toLowerCase().includes('inactive')) {
            status = 'inactive';
          }

          if (id && username) {
            resellers.push({
              id,
              username,
              email,
              name: notes || username,
              credits,
              expiry,
              ip,
              owner,
              status
            });
          }
        }
      }

      return {
        success: true,
        resellers,
        total: data.recordsFiltered || resellers.length
      };
    } catch (error) {
      this.log(`Erro ao buscar revendas: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, resellers: [] };
    }
  }

  async getResellerDetails(resellerId) {
    try {
      await this.ensureLoggedIn();

      this.log(`Buscando detalhes do revendedor ${resellerId}`);

      const response = await this.request('GET', `/reseller/${resellerId}/edit`);
      const html = response.data;
      const $ = cheerio.load(html);

      // Extrair dados do formulário de edição
      const reseller = {
        id: resellerId,
        username: $('input[name="username"]').val() || '',
        name: $('input[name="name"]').val() || $('input[name="notes"]').val() || '',
        email: $('input[name="email"]').val() || '',
        credits: parseInt($('input[name="credits"]').val()) || 0,
        maxConnections: parseInt($('input[name="max_connections"]').val()) || 0,
        expiry: $('input[name="exp_date"]').val() || '',
        status: $('select[name="status"] option:selected').val() || 'active'
      };

      return {
        success: true,
        reseller
      };
    } catch (error) {
      this.log(`Erro ao buscar detalhes do revendedor: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  async createReseller(data) {
    try {
      await this.ensureLoggedIn();

      const { username, password, name, credits, expiry } = data;

      this.log(`Criando revenda: ${username}`);

      // Obter token CSRF
      const response = await this.request('GET', '/reseller/create');
      const html = response.data;
      const $ = cheerio.load(html);
      const csrfToken = $('input[name="_token"]').val();

      if (!csrfToken) {
        throw new Error('Token CSRF não encontrado');
      }

      // Criar revenda
      const formData = new URLSearchParams();
      formData.append('_token', csrfToken);
      formData.append('username', username);
      formData.append('password', password);
      formData.append('name', name || username);
      formData.append('notes', name || username);
      formData.append('credits', credits || 0);
      formData.append('exp_date', expiry || '');
      formData.append('status', 'active');

      const createResponse = await this.request('POST', '/reseller', formData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      // Verificar sucesso
      if (createResponse.status === 302 || createResponse.data.includes('success') || createResponse.data.includes('criado')) {
        return {
          success: true,
          message: 'Revenda criada com sucesso',
          username
        };
      }

      // Verificar erros
      const $result = cheerio.load(createResponse.data);
      const errorMsg = $result('.alert-danger').text().trim() || 'Erro ao criar revenda';
      throw new Error(errorMsg);

    } catch (error) {
      this.log(`Erro ao criar revenda: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  async renewReseller(resellerId, months) {
    try {
      await this.ensureLoggedIn();

      this.log(`Renovando revenda ${resellerId} por ${months} meses`);

      // Obter página de edição para CSRF e data atual
      const response = await this.request('GET', `/reseller/${resellerId}/edit`);
      const html = response.data;
      const $ = cheerio.load(html);

      const csrfToken = $('input[name="_token"]').val();
      const currentExpiry = $('input[name="exp_date"]').val();

      if (!csrfToken) {
        throw new Error('Token CSRF não encontrado');
      }

      // Calcular nova data de expiração
      let baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
      if (isNaN(baseDate.getTime()) || baseDate < new Date()) {
        baseDate = new Date();
      }
      baseDate.setMonth(baseDate.getMonth() + months);
      const newExpiry = baseDate.toISOString().split('T')[0];

      // Atualizar
      const formData = new URLSearchParams();
      formData.append('_token', csrfToken);
      formData.append('_method', 'PUT');
      formData.append('exp_date', newExpiry);

      const updateResponse = await this.request('POST', `/reseller/${resellerId}`, formData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (updateResponse.status === 302 || updateResponse.data.includes('success')) {
        return {
          success: true,
          resellerId,
          months,
          newExpiry
        };
      }

      throw new Error('Falha ao renovar revenda');
    } catch (error) {
      this.log(`Erro ao renovar revenda: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // CRÉDITOS
  // =============================================

  async getCredits() {
    try {
      await this.ensureLoggedIn();

      this.log('Buscando saldo de créditos');

      // Acessar dashboard ou página que mostra créditos
      const response = await this.request('GET', '/dashboard');
      const html = response.data;
      const $ = cheerio.load(html);

      // Tentar encontrar créditos de várias formas
      let credits = 0;
      
      // Buscar em elementos comuns
      const creditsText = $('.credits, .credit-balance, [class*="credit"]').first().text();
      const match = creditsText.match(/(\d+)/);
      if (match) {
        credits = parseInt(match[1]);
      }

      // Buscar no navbar ou sidebar
      if (credits === 0) {
        const navCredits = $('nav, .sidebar, .navbar').text().match(/cr[eé]ditos?[:\s]*(\d+)/i);
        if (navCredits) {
          credits = parseInt(navCredits[1]);
        }
      }

      // Buscar em cards de dashboard
      if (credits === 0) {
        $('[class*="card"], [class*="box"], [class*="widget"]').each((i, el) => {
          const text = $(el).text();
          if (text.toLowerCase().includes('crédit') || text.toLowerCase().includes('credit')) {
            const num = text.match(/(\d+)/);
            if (num) credits = parseInt(num[1]);
          }
        });
      }

      return {
        success: true,
        credits
      };
    } catch (error) {
      this.log(`Erro ao buscar créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, credits: 0 };
    }
  }

  async addCreditsToReseller(resellerId, credits) {
    try {
      await this.ensureLoggedIn();

      this.log(`Adicionando ${credits} créditos ao revendedor ${resellerId}`);

      // Usar API dedicada de créditos (não precisa de CSRF!)
      const timestamp = Date.now();
      const url = `/resellers/api/?change_credits&reseller_id=${resellerId}&credits=${credits}&timestamp=${timestamp}`;
      
      const response = await this.request('POST', url, '', {
        'X-Requested-With': 'XMLHttpRequest'
      });
      
      // Verificar se sessão expirou
      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.log('Sessão expirada, reconectando...', 'WARN');
        this.sessionValid = false;
        await this.ensureLoggedIn();
        // Tentar novamente após reconectar
        return await this.addCreditsToReseller(resellerId, credits);
      }
      
      // Verificar resposta
      if (response.status === 200) {
        if (response.data && typeof response.data === 'object') {
          if (response.data.result === 'success') {
            this.log(`${credits} créditos adicionados ao revendedor ${resellerId}!`);
            return {
              success: true,
              resellerId,
              addedCredits: credits,
              data: response.data
            };
          } else if (response.data.result === 'failed') {
            throw new Error(response.data.msg || 'Falha na operação');
          }
        }
        
        // Resposta string
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            this.log(`${credits} créditos adicionados!`);
            return { success: true, resellerId, addedCredits: credits };
          }
        }
        
        // Se chegou aqui sem erro, provavelmente funcionou
        this.log(`${credits} créditos adicionados (resposta: ${JSON.stringify(response.data).substring(0, 100)})`);
        return { success: true, resellerId, addedCredits: credits };
      }
      
      throw new Error(`Resposta inesperada: ${JSON.stringify(response.data)}`);
      
    } catch (error) {
      this.log(`Erro ao adicionar créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  async removeCreditsFromReseller(resellerId, credits) {
    try {
      await this.ensureLoggedIn();

      this.log(`Removendo ${credits} créditos do revendedor ${resellerId}`);

      // Usar API dedicada de créditos com valor negativo
      const timestamp = Date.now();
      const url = `/resellers/api/?change_credits&reseller_id=${resellerId}&credits=-${credits}&timestamp=${timestamp}`;
      
      const response = await this.request('POST', url, '', {
        'X-Requested-With': 'XMLHttpRequest'
      });
      
      // Verificar se sessão expirou
      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.log('Sessão expirada, reconectando...', 'WARN');
        this.sessionValid = false;
        await this.ensureLoggedIn();
        // Tentar novamente após reconectar
        return await this.removeCreditsFromReseller(resellerId, credits);
      }
      
      // Verificar resposta
      if (response.status === 200) {
        if (response.data && typeof response.data === 'object') {
          if (response.data.result === 'success') {
            this.log(`${credits} créditos removidos do revendedor ${resellerId}!`);
            return {
              success: true,
              resellerId,
              removedCredits: credits,
              data: response.data
            };
          } else if (response.data.result === 'failed') {
            throw new Error(response.data.msg || 'Falha na operação');
          }
        }
        
        // Resposta string
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            this.log(`${credits} créditos removidos!`);
            return { success: true, resellerId, removedCredits: credits };
          }
        }
        
        // Se chegou aqui sem erro, provavelmente funcionou
        this.log(`${credits} créditos removidos (resposta: ${JSON.stringify(response.data).substring(0, 100)})`);
        return { success: true, resellerId, removedCredits: credits };
      }
      
      throw new Error(`Resposta inesperada: ${JSON.stringify(response.data)}`);
      
    } catch (error) {
      this.log(`Erro ao remover créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }
}

// =============================================
// FACTORY
// =============================================
const clientInstances = new Map();

export function getKofficeClient(account) {
  const key = `koffice_${account.id}`;
  
  if (!clientInstances.has(key)) {
    clientInstances.set(key, new KofficeClient(account));
  } else {
    // Atualizar dados da conta no cliente existente (cookies do banco podem ter mudado)
    const client = clientInstances.get(key);
    client.account = account;
    
    // Se os cookies do banco são mais recentes e o cliente não está logado, 
    // restaurar a sessão do banco
    if (account.session_cookies && !client.loggedIn) {
      try {
        const dbCookies = JSON.parse(account.session_cookies);
        if (Object.keys(dbCookies).length > 0) {
          client.cookies = dbCookies;
        }
      } catch (e) {
        // Ignorar erro de parse
      }
    }
  }
  
  return clientInstances.get(key);
}

export function clearKofficeClient(accountId) {
  const key = `koffice_${accountId}`;
  clientInstances.delete(key);
}

export { KofficeClient };
