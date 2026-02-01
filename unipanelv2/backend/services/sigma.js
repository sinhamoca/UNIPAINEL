/* ========================================
   SIGMA SERVICE - UniPanel Integration
   
   Serviço para interagir com painéis Sigma via Cloudflare Worker
   Suporta sessão persistente para múltiplas contas
   ======================================== */

import axios from 'axios';

class SigmaService {
  constructor(domain, username, password, authToken = null) {
    this.domain = domain.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.authToken = authToken;
    
    // Configuração do Worker
    this.workerUrl = process.env.SIGMA_WORKER_URL || 'https://summer-forest-2bc5sigma.isaacofc2.workers.dev';
    this.workerSecret = process.env.SIGMA_WORKER_SECRET || 'MinhaChaveSigma2024!';
    
    // Headers padrão para simular browser
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };
    
    // Cliente HTTP
    this.client = axios.create({
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`🔧 [SIGMA] Inicializado para: ${this.domain}`);
  }

  async delay(seconds = 2) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Faz requisição via Cloudflare Worker
   */
  async request(method, path, data = null, customHeaders = {}) {
    const url = `${this.domain}${path}`;
    
    console.log(`📤 [SIGMA] ${method} ${path}`);
    
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
    
    // Payload para o Worker
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
      console.log(`🔄 [SIGMA] Enviando para Worker: ${this.workerUrl}/proxy`);
      
      const response = await this.client.post(
        `${this.workerUrl}/proxy`,
        workerPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Secret': this.workerSecret
          },
          timeout: 60000 // 60 segundos de timeout (respostas podem ser grandes)
        }
      );
      
      console.log(`✅ [SIGMA] Resposta do Worker recebida`);
      
      const result = response.data;
      
      console.log(`📥 [SIGMA] Status: ${result.status} | Success: ${result.success}`);
      
      // Detectar tipo de erro
      if (!result.success && result.status >= 400) {
        const responseText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        
        // Verificar se é erro de autenticação (token expirado)
        if (result.status === 401) {
          console.warn(`🔑 [SIGMA] Token expirado ou inválido (401)`);
          throw new Error('AUTH_EXPIRED: Token expirado, precisa fazer login novamente');
        }
        
        // Verificar se é bloqueio do Cloudflare
        if (result.status === 403 && responseText.includes('Cloudflare')) {
          if (responseText.includes('you have been blocked')) {
            console.error(`🚫 [SIGMA] Bloqueio Cloudflare detectado para: ${this.domain}`);
            throw new Error('CLOUDFLARE_BLOCKED: Este domínio está bloqueando o acesso. Tente usar um domínio alternativo (ex: .site ao invés de .st)');
          }
          if (responseText.includes('challenge')) {
            console.error(`🔒 [SIGMA] Challenge Cloudflare detectado para: ${this.domain}`);
            throw new Error('CLOUDFLARE_CHALLENGE: Este domínio requer verificação. Tente usar um domínio alternativo');
          }
        }
        
        // Verificar se é erro de conectividade
        if (result.status === 502 || result.status === 503 || result.status === 504) {
          console.error(`🌐 [SIGMA] Erro de conectividade para: ${this.domain}`);
          throw new Error('CONNECTION_ERROR: Não foi possível conectar ao servidor. Verifique se o domínio está correto');
        }
        
        // Erro genérico
        console.error(`❌ [SIGMA] Erro ${result.status}: ${responseText.substring(0, 200)}`);
        throw new Error(`HTTP ${result.status}: ${result.statusText || 'Erro desconhecido'}`);
      }
      
      return result.data;
      
    } catch (error) {
      // Se já é um erro formatado, repassar
      if (error.message.startsWith('CLOUDFLARE_') || error.message.startsWith('CONNECTION_')) {
        throw error;
      }
      
      if (error.response) {
        console.error(`❌ [SIGMA] Worker erro:`, error.response.data);
        throw new Error(`Worker error: ${error.response.status}`);
      }
      console.error(`❌ [SIGMA] Conexão erro:`, error.message);
      throw error;
    }
  }

  /**
   * Inicializa sessão
   */
  async initSession() {
    console.log(`🔄 [SIGMA] Inicializando sessão...`);
    
    try {
      await this.request('GET', '/', null, {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      return true;
    } catch (error) {
      console.warn(`⚠️ [SIGMA] Erro na sessão (continuando): ${error.message}`);
      return true;
    }
  }

  /**
   * Fazer login
   */
  async login() {
    console.log(`🔑 [SIGMA] Fazendo login: ${this.username}`);
    
    await this.initSession();
    await this.delay(1);
    
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
    });
    
    // Extrair token
    const token = response.token || response.data?.token;
    
    if (token) {
      this.authToken = token;
      console.log('✅ [SIGMA] Login realizado com sucesso!');
      return { success: true, token };
    }
    
    throw new Error(`Login falhou: ${JSON.stringify(response)}`);
  }

  /**
   * Buscar clientes
   */
  async getCustomers(page = 1, perPage = 100, search = '') {
    console.log(`📥 [SIGMA] Buscando clientes (página ${page})...`);
    
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString()
    });
    
    if (search) {
      params.set('username', search);
    }
    
    const response = await this.request('GET', `/api/customers?${params.toString()}`);
    
    let customers = [];
    let pagination = { page, perPage, total: 0 };
    
    if (Array.isArray(response)) {
      customers = response;
    } else if (response.data && Array.isArray(response.data)) {
      customers = response.data;
      if (response.meta) {
        pagination = {
          page: response.meta.current_page || page,
          perPage: response.meta.per_page || perPage,
          total: response.meta.total || customers.length,
          totalPages: response.meta.last_page || 1
        };
      }
    }
    
    console.log(`📊 [SIGMA] ${customers.length} clientes encontrados`);
    
    return { customers, pagination };
  }

  /**
   * Buscar cliente por username
   */
  async findCustomerByUsername(username) {
    console.log(`🔍 [SIGMA] Buscando cliente: ${username}`);
    
    const { customers } = await this.getCustomers(1, 50, username);
    
    // Buscar por username exato
    let customer = customers.find(c => c.username === username);
    
    // Fallback: buscar em note
    if (!customer) {
      customer = customers.find(c => 
        c.note && c.note.toLowerCase().includes(username.toLowerCase())
      );
    }
    
    if (customer) {
      console.log(`✅ [SIGMA] Cliente encontrado: ${customer.username}`);
      return customer;
    }
    
    throw new Error(`Cliente ${username} não encontrado`);
  }

  /**
   * Buscar servidores e pacotes
   */
  async getServersAndPackages() {
    console.log('📦 [SIGMA] Buscando servidores e pacotes...');
    
    const response = await this.request('GET', '/api/servers');
    
    let servers = [];
    if (Array.isArray(response)) {
      servers = response;
    } else if (response.data && Array.isArray(response.data)) {
      servers = response.data;
    }
    
    // Extrair todos os pacotes
    const packages = [];
    for (const server of servers) {
      const serverPackages = server.packages || [];
      for (const pkg of serverPackages) {
        packages.push({
          id: pkg.id,
          name: pkg.name,
          server_id: server.id,
          server_name: server.name,
          status: pkg.status,
          price: pkg.plan_price || 0,
          credits: pkg.credits || 0,
          duration: pkg.duration || 1,
          duration_type: pkg.duration_in || 'MONTHS',
          connections: pkg.connections || 1,
          is_trial: pkg.is_trial === 'YES',
          is_mag: pkg.is_mag === 'YES'
        });
      }
    }
    
    console.log(`✅ [SIGMA] ${servers.length} servidores, ${packages.length} pacotes`);
    
    return { servers, packages };
  }

  /**
   * Renovar cliente
   */
  async renewCustomer(customerId, packageId, connections = 1) {
    console.log(`🔄 [SIGMA] Renovando cliente ${customerId} com pacote ${packageId}...`);
    
    await this.delay(1);
    
    const payload = {
      package_id: packageId,
      connections: parseInt(connections)
    };
    
    const response = await this.request(
      'POST',
      `/api/customers/${customerId}/renew`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    // Verificar sucesso
    const hasSuccess = response.message?.includes('sucesso') ||
                       response.expires_at ||
                       response.data?.expires_at ||
                       response.status === 'ACTIVE';
    
    if (hasSuccess || response.id || response.username) {
      console.log('✅ [SIGMA] Renovação realizada com sucesso!');
      const data = response.data || response;
      return {
        success: true,
        expires_at: data.expires_at,
        status: data.status,
        customer: data
      };
    }
    
    throw new Error(`Renovação falhou: ${JSON.stringify(response)}`);
  }

  /**
   * Buscar detalhes de um cliente
   */
  async getCustomerDetails(customerId) {
    console.log(`📋 [SIGMA] Buscando detalhes do cliente ${customerId}...`);
    
    const response = await this.request('GET', `/api/customers/${customerId}`);
    
    return response.data || response;
  }

  /**
   * Buscar playlist/dados completos do cliente
   * Retorna array com templates em diferentes idiomas
   * Ex: [{ key: 'en', template: '...' }, { key: 'pt', template: '...' }]
   */
  async getCustomerPlaylist(customerId) {
    console.log(`📋 [SIGMA] Buscando playlist do cliente ${customerId}...`);
    
    const response = await this.request('GET', `/api/customers/${customerId}/playlist`);
    
    return response;
  }

  /**
   * Buscar revendedores - SIMPLIFICADO (igual ao getCustomers)
   */
  async getResellers(page = 1, perPage = 20, search = '') {
    console.log(`📥 [SIGMA] Buscando revendedores (página ${page})...`);
    
    // Usar EXATAMENTE a mesma estrutura do getCustomers
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString()
    });
    
    if (search) {
      params.set('username', search);
    }
    
    const response = await this.request('GET', `/api/resellers?${params.toString()}`);
    
    let resellers = [];
    let pagination = { page, perPage, total: 0 };
    
    if (Array.isArray(response)) {
      resellers = response;
    } else if (response.data && Array.isArray(response.data)) {
      resellers = response.data;
      if (response.meta) {
        pagination = {
          page: response.meta.current_page || page,
          perPage: response.meta.per_page || perPage,
          total: response.meta.total || resellers.length,
          totalPages: response.meta.last_page || 1
        };
      }
    }
    
    console.log(`📊 [SIGMA] ${resellers.length} revendedores encontrados`);
    
    return { resellers, pagination };
  }

  /**
   * Buscar revendedor por ID ou username
   */
  async findResellerById(resellerId) {
    console.log(`🔍 [SIGMA] Buscando revendedor: ${resellerId}`);
    
    const { resellers } = await this.getResellers(1, 50, resellerId);
    
    // Buscar por username exato
    const exactMatch = resellers.find(r => 
      r.username.toLowerCase() === resellerId.toLowerCase()
    );
    
    if (exactMatch) {
      console.log(`✅ [SIGMA] Revendedor encontrado: ${exactMatch.username}`);
      return exactMatch;
    }
    
    // Se não encontrou exato, retornar o primeiro resultado
    if (resellers.length > 0) {
      return resellers[0];
    }
    
    throw new Error(`Revendedor ${resellerId} não encontrado`);
  }

  /**
   * Adicionar créditos a um revendedor
   */
  async addCredits(resellerId, credits) {
    console.log(`💰 [SIGMA] Adicionando ${credits} créditos ao revendedor ${resellerId}...`);
    
    await this.delay(1);
    
    const payload = {
      credits: parseInt(credits)
    };
    
    const response = await this.request(
      'POST',
      `/api/resellers/${resellerId}/add-credits`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    console.log('✅ [SIGMA] Créditos adicionados com sucesso!');
    
    return {
      success: true,
      response: response
    };
  }

  /**
   * Remover créditos de um revendedor
   */
  async removeCredits(resellerId, credits) {
    console.log(`💸 [SIGMA] Removendo ${credits} créditos do revendedor ${resellerId}...`);
    
    await this.delay(1);
    
    const payload = {
      credits: parseInt(credits)
    };
    
    const response = await this.request(
      'POST',
      `/api/resellers/${resellerId}/remove-credits`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    console.log('✅ [SIGMA] Créditos removidos com sucesso!');
    
    return {
      success: true,
      response: response
    };
  }
}

export default SigmaService;
