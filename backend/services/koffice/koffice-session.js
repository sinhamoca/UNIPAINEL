// =============================================
// KOFFICE SESSION
// Gerencia sessão individual com painel Koffice
// CORRIGIDO: Aceita todas renovações de cookies (igual ao original)
// =============================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import { updateKofficeSession } from '../../config/database.js';

// Worker URL para bypass do Cloudflare
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://broken-cake-764a.isaacofc2.workers.dev';

// Anti-Captcha API Key
function getAntiCaptchaKey() {
  return process.env.ANTICAPTCHA_KEY || '';
}

class KofficeSession {
  constructor(account) {
    this.account = account;
    this.accountId = account.id;
    this.domain = account.domain.replace(/\/$/, '');
    this.cookies = {};
    this.loggedIn = false;
    this.loginCount = 0;
    this.lastSessionCheck = 0;
    this.sessionStartTime = null;
  }

  // =============================================
  // LOGGING
  // =============================================
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KofficeSession:${this.accountId}] [${level}] ${message}`);
  }

  // =============================================
  // COOKIE MANAGEMENT (igual ao koffice-bot original)
  // =============================================
  getCookieString() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  setCookies(cookies) {
    this.cookies = cookies;
  }

  getCookies() {
    return this.cookies;
  }

  // IGUAL AO ORIGINAL: Aceita TODOS os cookies do servidor
  // O servidor pode renovar PHPSESSID legitimamente e precisamos aceitar
  saveCookies(setCookieArray) {
    if (!setCookieArray) return;
    
    const cookies = Array.isArray(setCookieArray) ? setCookieArray : [setCookieArray];

    cookies.forEach(cookieStr => {
      if (!cookieStr) return;
      const match = cookieStr.match(/^([^=]+)=([^;]*)/);
      if (match) {
        const oldValue = this.cookies[match[1]];
        this.cookies[match[1]] = match[2];
        
        // Log apenas se o cookie mudou
        if (oldValue && oldValue !== match[2] && match[1] === 'PHPSESSID') {
          this.log(`🔄 PHPSESSID renovado pelo servidor`);
        }
      }
    });
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
    const cookieString = this.getCookieString();
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
        if (!extraHeaders['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
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

      // IMPORTANTE: Sempre salvar cookies retornados (igual ao original)
      if (workerResponse.headers && workerResponse.headers['set-cookie']) {
        this.saveCookies(workerResponse.headers['set-cookie']);
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
  // LOGIN
  // =============================================
  async login() {
    const startTime = Date.now();
    this.log('Iniciando login...');

    // Limpar cookies antigos antes de novo login
    this.cookies = {};

    try {
      // 1. Obter página de login e CSRF token
      const loginPageResponse = await this.request('GET', '/login/');
      const loginHtml = loginPageResponse.data;
      const $ = cheerio.load(loginHtml);

      const csrfToken = $('input[name="csrf_token"]').val();
      if (!csrfToken) {
        throw new Error('CSRF Token não encontrado');
      }
      this.log(`CSRF Token: ${csrfToken}`);

      // 2. Verificar se tem hCaptcha E se a conta está configurada para resolver
      const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || $('[data-sitekey]').attr('data-sitekey');
      let hcaptchaToken = '';

      if (hcaptchaSiteKey && this.account.has_captcha) {
        this.log('hCaptcha detectado e conta configurada para resolver...');
        hcaptchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
      } else if (hcaptchaSiteKey && !this.account.has_captcha) {
        this.log('hCaptcha detectado mas conta NÃO está configurada para resolver. Tentando sem captcha...');
      }

      // 3. Fazer login
      const formData = new URLSearchParams();
      formData.append('try_login', '1');
      formData.append('csrf_token', csrfToken);
      formData.append('username', this.account.username);
      formData.append('password', this.account.password);

      if (hcaptchaToken) {
        formData.append('g-recaptcha-response', hcaptchaToken);
        formData.append('h-captcha-response', hcaptchaToken);
      }

      const loginResponse = await this.request('POST', '/login/', formData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/login/`
      });

      // 4. Debug da resposta
      this.log(`Login response status: ${loginResponse.status}`);

      const responseHtml = loginResponse.data || '';

      // Verificar se há mensagem de erro específica
      const $response = cheerio.load(responseHtml);
      const alertError = $response('.alert-danger').text() || $response('.error').text() || $response('.alert').text();
      if (alertError && alertError.trim()) {
        this.log(`Mensagem de erro encontrada: ${alertError.trim()}`);
      }

      // 5. Verificar redirect (alguns painéis retornam 302)
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const location = loginResponse.headers?.location || '';
        this.log(`Redirect detectado para: ${location}`);

        if (location.includes('login')) {
          throw new Error('Credenciais inválidas (redirect para login)');
        }

        // Seguir o redirect
        if (location) {
          const redirectUrl = location.startsWith('http') ? location : location;
          this.log(`Seguindo redirect para: ${redirectUrl}`);
          const redirectResponse = await this.request('GET', redirectUrl);

          if (redirectResponse.data && (redirectResponse.data.includes('logout') || redirectResponse.data.includes('sair'))) {
            this.loggedIn = true;
            this.loginCount++;
            this.sessionStartTime = Date.now();
            this.lastSessionCheck = Date.now();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            this.log(`LOGIN #${this.loginCount} OK em ${elapsed}s (via redirect)`, 'SUCCESS');

            await this.saveSession();
            return true;
          }
        }
      }

      // 6. Verificar se a resposta indica erro
      if (responseHtml.includes('Invalid') || responseHtml.includes('invalid') ||
          responseHtml.includes('incorrect') || responseHtml.includes('Incorrect')) {
        this.log(`Erro detectado na resposta: credenciais inválidas`);
        throw new Error('Credenciais inválidas');
      }

      // 7. Se ainda tem form de login na resposta, verificar se é erro ou se precisa seguir
      const hasLoginForm = responseHtml.includes('try_login') && responseHtml.includes('csrf_token');
      const hasLogoutLink = responseHtml.includes('logout') || responseHtml.includes('sair') || responseHtml.includes('Logout');
      const hasDashboard = responseHtml.includes('dashboard') || responseHtml.includes('Dashboard');

      // Se tem logout ou dashboard, login funcionou
      if (hasLogoutLink || hasDashboard) {
        this.loggedIn = true;
        this.loginCount++;
        this.sessionStartTime = Date.now();
        this.lastSessionCheck = Date.now();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log(`LOGIN #${this.loginCount} OK em ${elapsed}s`, 'SUCCESS');

        await this.saveSession();
        return true;
      }

      // 8. Tentar acessar /clients/ para confirmar (mesmo que resposta pareça ambígua)
      this.log('Verificando login acessando /clients/...');

      const checkResponse = await this.request('GET', '/clients/');
      const checkHtml = checkResponse.data || '';

      const checkHasLoginForm = checkHtml.includes('try_login') && checkHtml.includes('csrf_token');
      const checkHasLogout = checkHtml.includes('logout') || checkHtml.includes('sair');
      const checkHasClients = checkHtml.includes('clients') || checkHtml.includes('Clients');

      if (!checkHasLoginForm && (checkHasLogout || checkHasClients)) {
        this.loggedIn = true;
        this.loginCount++;
        this.sessionStartTime = Date.now();
        this.lastSessionCheck = Date.now();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log(`LOGIN #${this.loginCount} OK em ${elapsed}s (verificado via /clients/)`, 'SUCCESS');

        await this.saveSession();
        return true;
      }

      // Se chegou aqui e ainda tem form de login, realmente falhou
      if (checkHasLoginForm || hasLoginForm) {
        throw new Error('Credenciais inválidas ou captcha falhou');
      }

      throw new Error('Não foi possível validar o login');
    } catch (error) {
      this.log(`Erro no login: ${error.message}`, 'ERROR');
      this.loggedIn = false;
      throw error;
    }
  }

  // =============================================
  // SOLVE HCAPTCHA
  // =============================================
  async solveHCaptcha(siteKey) {
    const apiKey = getAntiCaptchaKey();
    if (!apiKey) {
      throw new Error('ANTICAPTCHA_KEY não configurada');
    }

    this.log('Enviando captcha para Anti-Captcha...');

    try {
      // Criar task
      const createResponse = await axios.post('https://api.anti-captcha.com/createTask', {
        clientKey: apiKey,
        task: {
          type: 'HCaptchaTaskProxyless',
          websiteURL: `${this.domain}/login/`,
          websiteKey: siteKey
        }
      });

      if (createResponse.data.errorId !== 0) {
        throw new Error(`Anti-Captcha error: ${createResponse.data.errorDescription}`);
      }

      const taskId = createResponse.data.taskId;
      this.log(`Task criada: ${taskId}`);

      // Aguardar resultado (max 120s)
      for (let i = 0; i < 24; i++) {
        await this.delay(5);

        const resultResponse = await axios.post('https://api.anti-captcha.com/getTaskResult', {
          clientKey: apiKey,
          taskId: taskId
        });

        if (resultResponse.data.status === 'ready') {
          this.log('Captcha resolvido!', 'SUCCESS');
          return resultResponse.data.solution.gRecaptchaResponse;
        }

        if (resultResponse.data.errorId !== 0) {
          throw new Error(`Anti-Captcha error: ${resultResponse.data.errorDescription}`);
        }
      }

      throw new Error('Timeout aguardando resolução do captcha');
    } catch (error) {
      this.log(`Erro ao resolver captcha: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // =============================================
  // CHECK SESSION (igual ao original - atualiza cookies!)
  // =============================================
  async checkSession() {
    try {
      const response = await this.request('GET', '/clients/');
      const html = response.data || '';

      // IMPORTANTE: Atualizar timestamp do último check
      this.lastSessionCheck = Date.now();

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
  // ENSURE LOGGED IN (igual ao original)
  // =============================================
  async ensureLoggedIn() {
    // Se tem cookies mas não está marcado como logado, verificar
    if (Object.keys(this.cookies).length > 0 && !this.loggedIn) {
      this.log('Cookies encontrados, verificando se sessão é válida...');
      const isActive = await this.checkSession();
      if (isActive) {
        this.loggedIn = true;
        this.lastSessionCheck = Date.now();
        this.log('Sessão validada via cookies existentes!');
        return true;
      }
      this.log('Cookies inválidos, limpando...');
      this.cookies = {};
    }

    // Se nunca logou ou não tem cookies
    if (!this.loggedIn || Object.keys(this.cookies).length === 0) {
      this.log('Sessão não iniciada, fazendo login...');

      // Tentar restaurar sessão do banco primeiro
      const restored = await this.restoreSession();
      if (restored) {
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

    // Já está logado, verificar periodicamente (a cada 5 minutos)
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
  // SAVE SESSION TO DATABASE
  // =============================================
  async saveSession() {
    const cookiesJson = JSON.stringify(this.cookies);
    // Sessão válida por 24 horas (aumentado de 2h)
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    updateKofficeSession(this.accountId, {
      cookies: cookiesJson,
      validUntil: validUntil
    });

    this.log('Sessão salva no banco');
  }

  // =============================================
  // RESTORE SESSION FROM DATABASE
  // =============================================
  async restoreSession() {
    if (!this.account.session_cookies || !this.account.session_valid_until) {
      return false;
    }

    // Verificar se sessão ainda é válida pelo timestamp
    const validUntil = new Date(this.account.session_valid_until);
    if (validUntil < new Date()) {
      this.log('Sessão do banco expirada pelo timestamp');
      return false;
    }

    try {
      this.cookies = JSON.parse(this.account.session_cookies);
      this.log(`Cookies restaurados do banco (PHPSESSID: ${this.cookies.PHPSESSID?.substring(0, 10)}...)`);
      return true;
    } catch (error) {
      this.log(`Erro ao restaurar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // =============================================
  // PING (para o Session Keeper)
  // =============================================
  async ping() {
    try {
      const isActive = await this.checkSession();
      if (!isActive && this.loggedIn) {
        this.log('Sessão expirou durante ping, re-logando...', 'WARN');
        this.loggedIn = false;
        await this.login();
      }
      return isActive || this.loggedIn;
    } catch (error) {
      this.log(`Erro no ping: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // =============================================
  // GET SESSION INFO
  // =============================================
  getSessionInfo() {
    const duration = this.sessionStartTime
      ? Math.floor((Date.now() - this.sessionStartTime) / 1000 / 60)
      : 0;

    return {
      accountId: this.accountId,
      loggedIn: this.loggedIn,
      duration,
      loginCount: this.loginCount,
      sessionStart: this.sessionStartTime,
      lastCheck: this.lastSessionCheck,
      hasCookies: Object.keys(this.cookies).length > 0,
      phpSessionId: this.cookies.PHPSESSID ? this.cookies.PHPSESSID.substring(0, 10) + '...' : null
    };
  }

  // =============================================
  // UTILITY
  // =============================================
  async delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}

export default KofficeSession;
