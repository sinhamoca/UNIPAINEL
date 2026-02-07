// =============================================
// KOFFICE API
// Operações com o painel Koffice
// =============================================

import * as cheerio from 'cheerio';
import {
  parseClientRow,
  parseResellerRow,
  extractCsrfToken,
  extractCredits,
  extractFastMessageData,
  isLoginPage,
  parseDataTableResponse
} from './koffice-parser.js';

class KofficeAPI {
  constructor(session) {
    this.session = session;
    this.domain = session.domain;
  }

  // =============================================
  // LOGGING
  // =============================================
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KofficeAPI:${this.session.accountId}] [${level}] ${message}`);
  }

  // =============================================
  // HELPER: Build DataTables Payload
  // =============================================
  buildDataTablesPayload(options = {}) {
    const {
      action = 'get_clients',
      start = 0,
      length = 20,
      search = '',
      draw = 1,
      orderColumn = 0,
      orderDir = 'desc',
      filterValue = '#',
      resellerId = '-1'
    } = options;

    const payload = new URLSearchParams();
    payload.append(action, '');
    payload.append('draw', draw.toString());
    payload.append('start', start.toString());
    payload.append('length', length.toString());
    payload.append('search[value]', search);
    payload.append('search[regex]', 'false');
    payload.append('order[0][column]', orderColumn.toString());
    payload.append('order[0][dir]', orderDir);
    
    if (action === 'get_clients') {
      payload.append('filter_value', filterValue);
      payload.append('reseller_id', resellerId);
    }

    // Adicionar colunas (0-9)
    for (let i = 0; i < 10; i++) {
      payload.append(`columns[${i}][data]`, i.toString());
      payload.append(`columns[${i}][name]`, '');
      payload.append(`columns[${i}][searchable]`, 'true');
      payload.append(`columns[${i}][orderable]`, 'true');
      payload.append(`columns[${i}][search][value]`, '');
      payload.append(`columns[${i}][search][regex]`, 'false');
    }

    return payload;
  }

  // =============================================
  // CLIENTS: Search
  // =============================================
  async searchClients(searchTerm, limit = 20) {
    await this.session.ensureLoggedIn();

    this.log(`Buscando clientes: "${searchTerm}"`);

    try {
      const payload = this.buildDataTablesPayload({
        action: 'get_clients',
        length: limit,
        search: searchTerm
      });

      const response = await this.session.request('POST', '/clients/api/?get_clients', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/clients/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      // Verificar se sessão expirou
      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.log('Sessão expirou, re-logando...', 'WARN');
        this.session.loggedIn = false;
        await this.session.login();
        return await this.searchClients(searchTerm, limit);
      }

      const result = parseDataTableResponse(response.data, parseClientRow);
      
      this.log(`Encontrados ${result.items.length} clientes`);

      return {
        success: result.success,
        total: result.total,
        clients: result.items,
        error: result.error
      };
    } catch (error) {
      this.log(`Erro ao buscar clientes: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, clients: [] };
    }
  }

  // =============================================
  // CLIENTS: Get Paginated
  // =============================================
  async getClients(page = 1, perPage = 20) {
    await this.session.ensureLoggedIn();

    const start = (page - 1) * perPage;

    try {
      const payload = this.buildDataTablesPayload({
        action: 'get_clients',
        start: start,
        length: perPage,
        draw: page
      });

      const response = await this.session.request('POST', '/clients/api/?get_clients', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/clients/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.getClients(page, perPage);
      }

      const result = parseDataTableResponse(response.data, parseClientRow);

      return {
        success: result.success,
        clients: result.items,
        pagination: {
          currentPage: page,
          perPage,
          total: result.total,
          lastPage: Math.ceil(result.total / perPage)
        },
        error: result.error
      };
    } catch (error) {
      this.log(`Erro ao listar clientes: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, clients: [] };
    }
  }

  // =============================================
  // CLIENTS: Renew
  // =============================================
  async renewClient(clientId, months) {
    await this.session.ensureLoggedIn();

    this.log(`Renovando cliente ${clientId} por ${months} mês(es)...`);

    try {
      const response = await this.session.request(
        'POST',
        `/clients/api/?renew_client_plus&client_id=${clientId}&months=${months}`,
        '',
        {
          'Referer': `${this.domain}/clients/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      );

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.renewClient(clientId, months);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        // Resposta não é JSON, verificar se é sucesso
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            return { success: true, clientId, months };
          }
        }
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log(`Cliente ${clientId} renovado!`, 'SUCCESS');
        return { success: true, clientId, months, data };
      } else if (data.result === 'failed') {
        throw new Error(data.msg || 'Falha na renovação');
      }

      throw new Error(`Resposta inesperada: ${JSON.stringify(data)}`);
    } catch (error) {
      this.log(`Erro ao renovar cliente: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // CLIENTS: Reset Attribute (username/password)
  // =============================================
  async resetClientAttribute(clientId, attribute) {
    await this.session.ensureLoggedIn();

    this.log(`Resetando ${attribute} do cliente ${clientId}...`);

    try {
      const payload = new URLSearchParams();
      payload.append('reset', '');
      payload.append('client_id', clientId);
      payload.append('attribute', attribute);

      const response = await this.session.request(
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

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.resetClientAttribute(clientId, attribute);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log(`${attribute} resetado: ${data.attribute_value}`, 'SUCCESS');
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
  // CLIENTS: Edit Notes
  // =============================================
  async editClientNotes(clientId, notes) {
    await this.session.ensureLoggedIn();

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

      const response = await this.session.request(
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
        this.log(`Notas atualizadas para: ${notes}`, 'SUCCESS');
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
  // CLIENTS: Get Fast Message (credentials)
  // =============================================
  async getClientFastMessage(clientId) {
    await this.session.ensureLoggedIn();

    this.log(`Obtendo dados do cliente ${clientId}...`);

    try {
      const payload = new URLSearchParams();
      payload.append('fast_message', '');
      payload.append('client_id', clientId);

      const response = await this.session.request(
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

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.getClientFastMessage(clientId);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log('Dados do cliente obtidos!', 'SUCCESS');

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
  // TEST: Create Fast Test
  // =============================================
  async createFastTest() {
    await this.session.ensureLoggedIn();

    this.log('Criando teste rápido...');

    try {
      const payload = new URLSearchParams();
      payload.append('fast_test', '');

      const response = await this.session.request(
        'POST',
        '/dashboard/api/?fast_test',
        payload.toString(),
        {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.domain}/dashboard/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      );

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.createFastTest();
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        throw new Error('Resposta inválida');
      }

      if (data.result === 'success') {
        this.log('Teste criado!', 'SUCCESS');

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
  // RESELLERS: Search
  // =============================================
  async searchResellers(searchTerm, limit = 20) {
    await this.session.ensureLoggedIn();

    this.log(`Buscando revendedores: "${searchTerm}"`);

    try {
      const payload = this.buildDataTablesPayload({
        action: 'get_resellers',
        length: limit,
        search: searchTerm
      });

      const response = await this.session.request('POST', '/resellers/api/?get_resellers', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/resellers/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.searchResellers(searchTerm, limit);
      }

      const result = parseDataTableResponse(response.data, parseResellerRow);

      this.log(`Encontrados ${result.items.length} revendedores`);

      return {
        success: result.success,
        total: result.total,
        resellers: result.items,
        error: result.error
      };
    } catch (error) {
      this.log(`Erro ao buscar revendedores: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, resellers: [] };
    }
  }

  // =============================================
  // RESELLERS: Get Paginated
  // =============================================
  async getResellers(page = 1, perPage = 20) {
    await this.session.ensureLoggedIn();

    const start = (page - 1) * perPage;

    try {
      const payload = this.buildDataTablesPayload({
        action: 'get_resellers',
        start: start,
        length: perPage,
        draw: page
      });

      const response = await this.session.request('POST', '/resellers/api/?get_resellers', payload.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${this.domain}/resellers/`,
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.getResellers(page, perPage);
      }

      const result = parseDataTableResponse(response.data, parseResellerRow);

      return {
        success: result.success,
        resellers: result.items,
        pagination: {
          currentPage: page,
          perPage,
          total: result.total,
          lastPage: Math.ceil(result.total / perPage)
        },
        error: result.error
      };
    } catch (error) {
      this.log(`Erro ao listar revendedores: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, resellers: [] };
    }
  }

  // =============================================
  // RESELLERS: Get Details
  // =============================================
  async getResellerDetails(resellerId) {
    await this.session.ensureLoggedIn();

    this.log(`Buscando detalhes do revendedor ${resellerId}...`);

    try {
      const response = await this.session.request('GET', `/reseller/${resellerId}/edit`);
      const html = response.data;

      if (isLoginPage(html)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.getResellerDetails(resellerId);
      }

      const $ = cheerio.load(html);

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

      return { success: true, reseller };
    } catch (error) {
      this.log(`Erro ao buscar detalhes: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // RESELLERS: Create
  // =============================================
  async createReseller(data) {
    await this.session.ensureLoggedIn();

    const { username, password, name, credits, expiry } = data;

    this.log(`Criando revenda: ${username}...`);

    try {
      // Obter CSRF token
      const pageResponse = await this.session.request('GET', '/reseller/create');
      const csrfToken = extractCsrfToken(pageResponse.data);

      if (!csrfToken) {
        throw new Error('Token CSRF não encontrado');
      }

      const formData = new URLSearchParams();
      formData.append('_token', csrfToken);
      formData.append('username', username);
      formData.append('password', password);
      if (name) formData.append('name', name);
      if (credits) formData.append('credits', credits.toString());
      if (expiry) formData.append('exp_date', expiry);

      const response = await this.session.request('POST', '/reseller', formData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (response.status === 302 || (response.data && response.data.includes('success'))) {
        this.log(`Revenda ${username} criada!`, 'SUCCESS');
        return { success: true, username };
      }

      throw new Error('Falha ao criar revenda');
    } catch (error) {
      this.log(`Erro ao criar revenda: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // RESELLERS: Renew
  // =============================================
  async renewReseller(resellerId, months) {
    await this.session.ensureLoggedIn();

    this.log(`Renovando revenda ${resellerId} por ${months} mês(es)...`);

    try {
      // Obter dados atuais
      const detailsResponse = await this.session.request('GET', `/reseller/${resellerId}/edit`);
      const $ = cheerio.load(detailsResponse.data);
      
      const csrfToken = $('input[name="_token"]').val();
      const currentExpiry = $('input[name="exp_date"]').val();

      if (!csrfToken) {
        throw new Error('Token CSRF não encontrado');
      }

      // Calcular nova data
      let baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
      if (isNaN(baseDate.getTime()) || baseDate < new Date()) {
        baseDate = new Date();
      }
      baseDate.setMonth(baseDate.getMonth() + months);
      const newExpiry = baseDate.toISOString().split('T')[0];

      const formData = new URLSearchParams();
      formData.append('_token', csrfToken);
      formData.append('_method', 'PUT');
      formData.append('exp_date', newExpiry);

      const response = await this.session.request('POST', `/reseller/${resellerId}`, formData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (response.status === 302 || (response.data && response.data.includes('success'))) {
        this.log(`Revenda ${resellerId} renovada!`, 'SUCCESS');
        return { success: true, resellerId, months, newExpiry };
      }

      throw new Error('Falha ao renovar revenda');
    } catch (error) {
      this.log(`Erro ao renovar revenda: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // CREDITS: Get Balance
  // =============================================
  async getCredits() {
    await this.session.ensureLoggedIn();

    this.log('Buscando saldo de créditos...');

    try {
      const response = await this.session.request('GET', '/dashboard');
      const credits = extractCredits(response.data);

      return { success: true, credits };
    } catch (error) {
      this.log(`Erro ao buscar créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, credits: 0 };
    }
  }

  // =============================================
  // CREDITS: Add to Reseller
  // =============================================
  async addCreditsToReseller(resellerId, credits) {
    await this.session.ensureLoggedIn();

    this.log(`Adicionando ${credits} créditos ao revendedor ${resellerId}...`);

    try {
      const timestamp = Date.now();
      const url = `/resellers/api/?change_credits&reseller_id=${resellerId}&credits=${credits}&timestamp=${timestamp}`;

      const response = await this.session.request('POST', url, '', {
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.addCreditsToReseller(resellerId, credits);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            return { success: true, resellerId, addedCredits: credits };
          }
        }
        data = {};
      }

      if (data.result === 'success' || response.status === 200) {
        this.log(`${credits} créditos adicionados!`, 'SUCCESS');
        return { success: true, resellerId, addedCredits: credits, data };
      }

      throw new Error(data.msg || 'Falha na operação');
    } catch (error) {
      this.log(`Erro ao adicionar créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // CREDITS: Remove from Reseller
  // =============================================
  async removeCreditsFromReseller(resellerId, credits) {
    await this.session.ensureLoggedIn();

    this.log(`Removendo ${credits} créditos do revendedor ${resellerId}...`);

    try {
      const timestamp = Date.now();
      const url = `/resellers/api/?change_credits&reseller_id=${resellerId}&credits=-${credits}&timestamp=${timestamp}`;

      const response = await this.session.request('POST', url, '', {
        'X-Requested-With': 'XMLHttpRequest'
      });

      if (typeof response.data === 'string' && isLoginPage(response.data)) {
        this.session.loggedIn = false;
        await this.session.login();
        return await this.removeCreditsFromReseller(resellerId, credits);
      }

      let data;
      try {
        data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (e) {
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            return { success: true, resellerId, removedCredits: credits };
          }
        }
        data = {};
      }

      if (data.result === 'success' || response.status === 200) {
        this.log(`${credits} créditos removidos!`, 'SUCCESS');
        return { success: true, resellerId, removedCredits: credits, data };
      }

      throw new Error(data.msg || 'Falha na operação');
    } catch (error) {
      this.log(`Erro ao remover créditos: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }
}

export default KofficeAPI;