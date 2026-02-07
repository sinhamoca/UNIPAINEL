// =============================================
// SIGMA SESSION
// Gerencia sessão individual com painel Sigma
// CORRIGIDO: checkSession usa /api/servers ao invés de /api/me
// =============================================

import axios from 'axios';

class SigmaSession {
  constructor(account) {
    this.account = account;
    this.accountId = account.id;
    this.domain = account.domain.replace(/\/$/, '');
    this.username = account.username;
    this.password = account.password;
    this.authToken = account.auth_token || null;
    
    this.loggedIn = !!this.authToken;
    this.loginCount = 0;
    this.lastSessionCheck = 0;
    this.sessionStartTime = this.authToken ? Date.now() : null;
    
    // Worker config
    this.workerUrl = process.env.SIGMA_WORKER_URL || 'https://summer-forest-2bc5sigma.isaacofc2.workers.dev';
    this.workerSecret = process.env.SIGMA_WORKER_SECRET || 'MinhaChaveSigma2024!';
    
    // HTTP client
    this.client = axios.create({
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Default headers
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    };
  }

  // =============================================
  // LOGGING
  // =============================================
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SigmaSession:${this.accountId}] [${level}] ${message}`);
  }

  // =============================================
  // UTILITY
  // =============================================
  async delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  // =============================================
  // HTTP REQUEST VIA WORKER
  // =============================================
  async request(method, path, data = null, customHeaders = {}, skipAuthCheck = false) {
    const url = `${this.domain}${path}`;
    
    // Montar headers
    const headers = {
      ...this.defaultHeaders,
      ...customHeaders,
      'Origin': this.domain,
      'Referer': `${this.domain}/`
    };
    
    // Adicionar token se existir
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    // Payload para Worker
    const workerPayload = {
      method,
      url,
      headers
    };
    
    // Adicionar body se necessário
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      workerPayload.body = data;
    }
    
    try {
      const response = await this.client.post(
        `${this.workerUrl}/proxy`,
        workerPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Secret': this.workerSecret
          },
          timeout: 60000
        }
      );
      
      const result = response.data;
      
      // Verificar se token expirou (401)
      if (result.status === 401 && !skipAuthCheck) {
        this.log('Token expirado (401), fazendo re-login...', 'WARN');
        this.loggedIn = false;
        this.authToken = null;
        
        // Re-login automático
        await this.login();
        
        // Tentar requisição novamente com novo token
        return await this.request(method, path, data, customHeaders, true);
      }
      
      // Outros erros
      if (!result.success && result.status >= 400) {
        const errorText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        throw new Error(`HTTP ${result.status}: ${errorText.substring(0, 200)}`);
      }
      
      return {
        status: result.status,
        data: result.data,
        headers: result.headers
      };
    } catch (error) {
      if (error.message.includes('AUTH_EXPIRED') || error.message.includes('401')) {
        throw error;
      }
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
    
    try {
      // Init session
      try {
        await this.request('GET', '/', null, {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }, true);
      } catch (e) {
        // Ignorar erros de init
      }
      
      await this.delay(1);
      
      // Login
      const loginData = {
        captcha: "not-a-robot",
        captchaChecked: true,
        username: this.username,
        password: this.password,
        twofactor_code: "",
        twofactor_recovery_code: "",
        twofactor_trusted_device_id: ""
      };
      
      const response = await this.request('POST', '/api/auth/login', loginData, {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      }, true);
      
      // Extrair token
      const responseData = response.data;
      const token = responseData?.token || responseData?.data?.token;
      
      if (token) {
        this.authToken = token;
        this.loggedIn = true;
        this.loginCount++;
        this.sessionStartTime = Date.now();
        this.lastSessionCheck = Date.now();
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log(`LOGIN #${this.loginCount} OK em ${elapsed}s`, 'SUCCESS');
        
        return { success: true, token };
      }
      
      throw new Error('Token não retornado pelo servidor');
    } catch (error) {
      this.log(`Erro no login: ${error.message}`, 'ERROR');
      this.loggedIn = false;
      throw error;
    }
  }

  // =============================================
  // CHECK SESSION (usa /api/servers que sabemos que existe)
  // =============================================
  async checkSession() {
    if (!this.authToken) {
      this.log('Sem token, sessão inválida');
      return false;
    }
    
    try {
      // Usar /api/servers que sabemos que existe em todas as instâncias Sigma
      // É uma requisição leve que valida o token
      const response = await this.request('GET', '/api/servers', null, {}, true);
      
      this.lastSessionCheck = Date.now();
      
      // Se chegou aqui sem erro, token é válido
      if (response.status === 200) {
        return true;
      }
      
      // 401 = token expirado
      if (response.status === 401) {
        this.log('Token expirado (401 em checkSession)', 'WARN');
        this.loggedIn = false;
        return false;
      }
      
      // Outros status podem indicar problema
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      // Se erro é 401, token expirou
      if (error.message.includes('401') || error.message.includes('AUTH_EXPIRED')) {
        this.log('Token expirou durante check', 'WARN');
        this.loggedIn = false;
        return false;
      }
      
      // Se erro é 404, endpoint não existe mas token pode ser válido
      // Isso não deveria acontecer com /api/servers mas tratamos por segurança
      if (error.message.includes('404')) {
        this.log('Endpoint não encontrado, assumindo token válido', 'WARN');
        this.lastSessionCheck = Date.now();
        return this.loggedIn;
      }
      
      // Outros erros (rede, timeout) - assumir que sessão ainda pode ser válida
      this.log(`Erro ao verificar sessão: ${error.message}`, 'WARN');
      return this.loggedIn;
    }
  }

  // =============================================
  // ENSURE LOGGED IN
  // =============================================
  async ensureLoggedIn() {
    // Se não tem token, fazer login
    if (!this.authToken) {
      this.log('Sem token, fazendo login...');
      await this.login();
      return true;
    }
    
    // Verificar periodicamente (a cada 5 minutos)
    const now = Date.now();
    const lastCheck = this.lastSessionCheck || 0;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (now - lastCheck > fiveMinutes) {
      this.log('Verificando se token ainda é válido...');
      const isActive = await this.checkSession();
      
      if (!isActive) {
        this.log('Token inválido, re-logando...', 'WARN');
        await this.login();
      }
    }
    
    return true;
  }

  // =============================================
  // PING (para o Session Keeper)
  // =============================================
  async ping() {
    try {
      const isActive = await this.checkSession();
      
      if (!isActive && this.authToken) {
        this.log('Sessão expirou durante ping, re-logando...', 'WARN');
        await this.login();
        return true;
      }
      
      return isActive;
    } catch (error) {
      this.log(`Erro no ping: ${error.message}`, 'ERROR');
      
      // Tentar re-login
      try {
        await this.login();
        return true;
      } catch (loginError) {
        this.log(`Falha no re-login: ${loginError.message}`, 'ERROR');
        return false;
      }
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
      hasToken: !!this.authToken,
      duration,
      loginCount: this.loginCount,
      sessionStart: this.sessionStartTime,
      lastCheck: this.lastSessionCheck
    };
  }

  // =============================================
  // GET/SET TOKEN
  // =============================================
  getToken() {
    return this.authToken;
  }
  
  setToken(token) {
    this.authToken = token;
    this.loggedIn = !!token;
  }
}

export default SigmaSession;