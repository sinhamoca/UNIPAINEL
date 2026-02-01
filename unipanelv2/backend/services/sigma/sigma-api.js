// =============================================
// SIGMA API
// Métodos para interagir com a API do Sigma
// Usa SigmaSession para gerenciar autenticação
// =============================================

class SigmaAPI {
  constructor(session) {
    this.session = session;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SigmaAPI:${this.session.accountId}] [${level}] ${message}`);
  }

  async delay(seconds = 1) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  // =============================================
  // CUSTOMERS
  // =============================================
  
  async getCustomers(page = 1, perPage = 100, search = '') {
    this.log(`Buscando clientes (página ${page})...`);
    
    await this.session.ensureLoggedIn();
    
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString()
    });
    
    if (search) {
      params.set('username', search);
    }
    
    const response = await this.session.request('GET', `/api/customers?${params.toString()}`);
    
    let customers = [];
    let pagination = { page, perPage, total: 0 };
    
    const data = response.data;
    
    if (Array.isArray(data)) {
      customers = data;
    } else if (data?.data && Array.isArray(data.data)) {
      customers = data.data;
      if (data.meta) {
        pagination = {
          page: data.meta.current_page || page,
          perPage: data.meta.per_page || perPage,
          total: data.meta.total || customers.length,
          totalPages: data.meta.last_page || 1
        };
      }
    }
    
    this.log(`${customers.length} clientes encontrados`);
    
    return { customers, pagination };
  }

  async getCustomerDetails(customerId) {
    this.log(`Buscando detalhes do cliente ${customerId}...`);
    
    await this.session.ensureLoggedIn();
    
    const response = await this.session.request('GET', `/api/customers/${customerId}`);
    
    return response.data?.data || response.data;
  }

  async findCustomerByUsername(username) {
    this.log(`Buscando cliente: ${username}`);
    
    const { customers } = await this.getCustomers(1, 50, username);
    
    let customer = customers.find(c => c.username === username);
    
    if (!customer) {
      customer = customers.find(c => 
        c.note && c.note.toLowerCase().includes(username.toLowerCase())
      );
    }
    
    if (customer) {
      this.log(`Cliente encontrado: ${customer.username}`);
      return customer;
    }
    
    throw new Error(`Cliente ${username} não encontrado`);
  }

  async getCustomerPlaylist(customerId) {
    this.log(`Buscando playlist do cliente ${customerId}...`);
    
    await this.session.ensureLoggedIn();
    
    const response = await this.session.request('GET', `/api/customers/${customerId}/playlist`);
    
    return response.data?.data || response.data;
  }

  // =============================================
  // PACKAGES & SERVERS
  // =============================================

  async getServersAndPackages() {
    this.log('Buscando servidores e pacotes...');
    
    await this.session.ensureLoggedIn();
    
    const response = await this.session.request('GET', '/api/servers');
    
    const data = response.data;
    let servers = [];
    
    if (Array.isArray(data)) {
      servers = data;
    } else if (data?.data && Array.isArray(data.data)) {
      servers = data.data;
    }
    
    // Extrair pacotes
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
          is_mag: pkg.is_mag === 'YES',
          trial_hours: pkg.trial_hours || pkg.duration || 0
        });
      }
    }
    
    this.log(`${servers.length} servidores, ${packages.length} pacotes`);
    
    return { servers, packages };
  }

  async getTrialPackages() {
    this.log('Buscando pacotes trial...');
    
    const { packages } = await this.getServersAndPackages();
    const trialPackages = packages.filter(pkg => pkg.is_trial === true);
    
    this.log(`${trialPackages.length} pacotes trial encontrados`);
    
    return trialPackages;
  }

  // =============================================
  // RENEWAL
  // =============================================

  async renewCustomer(customerId, packageId, connections = 1) {
    this.log(`Renovando cliente ${customerId} com pacote ${packageId}...`);
    
    await this.session.ensureLoggedIn();
    await this.delay(1);
    
    const payload = {
      package_id: packageId,
      connections: parseInt(connections)
    };
    
    const response = await this.session.request(
      'POST',
      `/api/customers/${customerId}/renew`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    const data = response.data?.data || response.data;
    
    const hasSuccess = data?.message?.includes('sucesso') ||
                       data?.expires_at ||
                       data?.status === 'ACTIVE' ||
                       data?.id;
    
    if (hasSuccess) {
      this.log('Renovação realizada com sucesso!', 'SUCCESS');
      return {
        success: true,
        expires_at: data.expires_at,
        status: data.status,
        customer: data
      };
    }
    
    throw new Error(`Renovação falhou: ${JSON.stringify(data)}`);
  }

  // =============================================
  // TRIAL CUSTOMER
  // =============================================

  async createTrialCustomer(serverId, packageId, trialHours = 24, connections = 1) {
    this.log(`Criando cliente trial (servidor ${serverId}, pacote ${packageId})...`);
    
    await this.session.ensureLoggedIn();
    await this.delay(1);
    
    const payload = {
      server_id: parseInt(serverId),
      package_id: parseInt(packageId),
      trial_hours: parseInt(trialHours),
      connections: parseInt(connections)
    };
    
    const response = await this.session.request(
      'POST',
      '/api/customers',
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    const data = response.data?.data || response.data;
    const customer = data?.customer || data;
    
    if (!customer || !customer.id) {
      throw new Error('Cliente não foi criado corretamente');
    }
    
    this.log(`Cliente trial criado: ${customer.username}`, 'SUCCESS');
    
    // Buscar playlist
    let playlist = null;
    try {
      await this.delay(1);
      playlist = await this.getCustomerPlaylist(customer.id);
    } catch (e) {
      this.log(`Aviso: não foi possível buscar playlist: ${e.message}`, 'WARN');
    }
    
    return {
      customer,
      playlist
    };
  }

  // =============================================
  // RESELLERS
  // =============================================

  async getResellers(page = 1, perPage = 20, search = '') {
    this.log(`Buscando revendedores (página ${page})...`);
    
    await this.session.ensureLoggedIn();
    
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString()
    });
    
    if (search) {
      params.set('username', search);
    }
    
    const response = await this.session.request('GET', `/api/resellers?${params.toString()}`);
    
    const data = response.data;
    let resellers = [];
    let pagination = { page, perPage, total: 0 };
    
    if (Array.isArray(data)) {
      resellers = data;
    } else if (data?.data && Array.isArray(data.data)) {
      resellers = data.data;
      if (data.meta) {
        pagination = {
          page: data.meta.current_page || page,
          perPage: data.meta.per_page || perPage,
          total: data.meta.total || resellers.length,
          totalPages: data.meta.last_page || 1
        };
      }
    }
    
    this.log(`${resellers.length} revendedores encontrados`);
    
    return { resellers, pagination };
  }

  async findResellerById(resellerId) {
    this.log(`Buscando revendedor: ${resellerId}`);
    
    const { resellers } = await this.getResellers(1, 50, resellerId);
    
    const exactMatch = resellers.find(r => 
      r.username.toLowerCase() === resellerId.toLowerCase()
    );
    
    if (exactMatch) {
      this.log(`Revendedor encontrado: ${exactMatch.username}`);
      return exactMatch;
    }
    
    if (resellers.length > 0) {
      return resellers[0];
    }
    
    throw new Error(`Revendedor ${resellerId} não encontrado`);
  }

  async addCredits(resellerId, credits) {
    this.log(`Adicionando ${credits} créditos ao revendedor ${resellerId}...`);
    
    await this.session.ensureLoggedIn();
    await this.delay(1);
    
    const payload = {
      credits: parseInt(credits)
    };
    
    const response = await this.session.request(
      'POST',
      `/api/resellers/${resellerId}/add-credits`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    this.log('Créditos adicionados com sucesso!', 'SUCCESS');
    
    return {
      success: true,
      response: response.data
    };
  }

  async removeCredits(resellerId, credits) {
    this.log(`Removendo ${credits} créditos do revendedor ${resellerId}...`);
    
    await this.session.ensureLoggedIn();
    await this.delay(1);
    
    const payload = {
      credits: parseInt(credits)
    };
    
    const response = await this.session.request(
      'POST',
      `/api/resellers/${resellerId}/remove-credits`,
      payload,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
    
    this.log('Créditos removidos com sucesso!', 'SUCCESS');
    
    return {
      success: true,
      response: response.data
    };
  }
}

export default SigmaAPI;
