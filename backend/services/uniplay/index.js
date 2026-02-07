// ========================================
// UNIPLAY SERVICE - GesAPIOffice Integration
// Login sob demanda COM proxy (Cloudflare)
// Cache de token por 30 minutos
// ========================================

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { run, get, all } from '../../config/database.js';

// ========================================
// CONFIGURAÇÃO
// ========================================

const CONFIG = {
  baseURL: 'https://gesapioffice.com',
  tokenCacheMinutes: 30, // Cache do token por 30 minutos
  requestTimeout: 45000,  // 45 segundos
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://gestordefender.com',
    'Referer': 'https://gestordefender.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
  }
};

// ========================================
// PROXY CONFIGURATION
// ========================================

function getProxyAgent() {
  const proxyHost = process.env.UNIPLAY_PROXY_HOST;
  const proxyPort = process.env.UNIPLAY_PROXY_PORT;
  const proxyUser = process.env.UNIPLAY_PROXY_USER;
  const proxyPass = process.env.UNIPLAY_PROXY_PASS;
  
  if (!proxyHost || !proxyPort) {
    console.warn('[Uniplay] ⚠️ Proxy não configurado! Configure as variáveis UNIPLAY_PROXY_*');
    return null;
  }
  
  // Formato: socks5://user:pass@host:port
  let proxyUrl;
  if (proxyUser && proxyPass) {
    proxyUrl = `socks5://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  } else {
    proxyUrl = `socks5://${proxyHost}:${proxyPort}`;
  }
  
  console.log(`[Uniplay] 🔌 Usando proxy: ${proxyHost}:${proxyPort}`);
  
  return new SocksProxyAgent(proxyUrl);
}

// Cliente HTTP com proxy
function createHttpClient() {
  const agent = getProxyAgent();
  
  const clientConfig = {
    baseURL: CONFIG.baseURL,
    timeout: CONFIG.requestTimeout,
    headers: CONFIG.headers
  };
  
  if (agent) {
    clientConfig.httpAgent = agent;
    clientConfig.httpsAgent = agent;
  }
  
  return axios.create(clientConfig);
}

// ========================================
// CACHE DE TOKENS EM MEMÓRIA
// ========================================

const tokenCache = new Map();

function getCachedToken(accountId) {
  const cached = tokenCache.get(accountId);
  if (!cached) return null;
  
  // Verificar se expirou
  if (Date.now() > cached.expiresAt) {
    tokenCache.delete(accountId);
    console.log(`[Uniplay] Token cache expirado para conta ${accountId}`);
    return null;
  }
  
  console.log(`[Uniplay] ✅ Usando token do cache para conta ${accountId}`);
  return cached;
}

function setCachedToken(accountId, token, userId, cryptPass) {
  const expiresAt = Date.now() + (CONFIG.tokenCacheMinutes * 60 * 1000);
  
  tokenCache.set(accountId, {
    token,
    userId,
    cryptPass,
    expiresAt,
    cachedAt: new Date().toISOString()
  });
  
  console.log(`[Uniplay] 💾 Token cacheado para conta ${accountId} (expira em ${CONFIG.tokenCacheMinutes}min)`);
}

function clearCachedToken(accountId) {
  tokenCache.delete(accountId);
  console.log(`[Uniplay] 🗑️ Token cache limpo para conta ${accountId}`);
}

// ========================================
// REQUISIÇÃO HTTP
// ========================================

async function makeRequest(method, endpoint, data = null, token = null) {
  const client = createHttpClient();
  
  const config = {
    method,
    url: endpoint,
    headers: { ...CONFIG.headers }
  };
  
  // Adicionar Authorization se tiver token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Adicionar body se for POST/PUT
  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.data = data;
  }
  
  console.log(`[Uniplay] 📤 ${method} ${endpoint}`);
  
  try {
    const response = await client.request(config);
    console.log(`[Uniplay] 📥 Status: ${response.status}`);
    return response.data;
  } catch (error) {
    // Verificar se é erro do Cloudflare
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 403 || status === 503) {
        throw new Error('Cloudflare bloqueou a requisição - verifique o proxy');
      }
      
      if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
        throw new Error('Cloudflare bloqueou a requisição - resposta HTML recebida');
      }
      
      throw new Error(`Erro ${status}: ${JSON.stringify(data)}`);
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new Error('Falha na conexão com proxy - verifique as configurações');
    }
    
    throw error;
  }
}

// ========================================
// LOGIN
// ========================================

async function login(username, password) {
  console.log(`[Uniplay] 🔐 Fazendo login para: ${username}`);
  
  const response = await makeRequest('POST', '/api/login', {
    username: username,
    password: password,
    code: ""
  });
  
  if (!response.access_token) {
    throw new Error(response.message || 'Login falhou - token não recebido');
  }
  
  console.log(`[Uniplay] ✅ Login OK! User ID: ${response.id}`);
  
  return {
    token: response.access_token,
    userId: response.id,
    cryptPass: response.crypt_pass,
    userData: response
  };
}

// ========================================
// OBTER TOKEN VÁLIDO (COM CACHE)
// ========================================

async function getValidToken(account) {
  // 1. Tentar do cache
  const cached = getCachedToken(account.id);
  if (cached) {
    return cached;
  }
  
  // 2. Fazer login
  console.log('[Uniplay] Token não em cache, fazendo login...');
  const loginResult = await login(account.username, account.password);
  
  // 3. Salvar no cache
  setCachedToken(account.id, loginResult.token, loginResult.userId, loginResult.cryptPass);
  
  // 4. Atualizar último login no banco
  try {
    run('UPDATE uniplay_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [account.id]);
  } catch (e) {
    console.warn('[Uniplay] Aviso: não foi possível atualizar last_login_at');
  }
  
  return {
    token: loginResult.token,
    userId: loginResult.userId,
    cryptPass: loginResult.cryptPass
  };
}

// ========================================
// LISTAR CLIENTES P2P
// ========================================

async function getP2PClients(account) {
  const auth = await getValidToken(account);
  
  console.log('[Uniplay] 📋 Buscando clientes P2P...');
  
  const response = await makeRequest('GET', '/api/users-p2p', null, auth.token);
  
  if (!Array.isArray(response)) {
    console.log('[Uniplay] Resposta P2P não é array:', typeof response);
    return [];
  }
  
  console.log(`[Uniplay] ✅ ${response.length} clientes P2P encontrados`);
  
  return response.map(function(client) {
    return {
      id: client.id,
      name: cleanClientName(client.nota),
      username: client.name,
      password: client.pass,
      expiry: client.endTime,
      status: client.status,
      type: 'p2p',
      raw: client
    };
  });
}

// ========================================
// LISTAR CLIENTES IPTV
// ========================================

async function getIPTVClients(account) {
  const auth = await getValidToken(account);
  
  console.log('[Uniplay] 📋 Buscando clientes IPTV...');
  
  const endpoint = '/api/users-iptv?reg_password=' + encodeURIComponent(auth.cryptPass);
  const response = await makeRequest('GET', endpoint, null, auth.token);
  
  if (!Array.isArray(response)) {
    console.log('[Uniplay] Resposta IPTV não é array:', typeof response);
    return [];
  }
  
  console.log(`[Uniplay] ✅ ${response.length} clientes IPTV encontrados`);
  
  return response.map(function(client) {
    return {
      id: client.id,
      name: cleanClientName(client.nota),
      username: client.username,
      password: client.password,
      expiry: client.exp_date,
      status: client.status,
      type: 'iptv',
      raw: client
    };
  });
}

// ========================================
// LISTAR TODOS OS CLIENTES
// ========================================

async function getAllClients(account) {
  const p2p = await getP2PClients(account);
  const iptv = await getIPTVClients(account);
  
  return {
    p2p: p2p,
    iptv: iptv,
    total: p2p.length + iptv.length
  };
}

// ========================================
// RENOVAR CLIENTE
// ========================================

async function renewClient(account, clientId, clientType, credits) {
  const auth = await getValidToken(account);
  
  const endpoint = clientType === 'iptv' ? '/api/users-iptv/' : '/api/users-p2p/';
  const fullEndpoint = endpoint + clientId;
  
  console.log(`[Uniplay] 🔄 Renovando cliente ${clientId} (${clientType}) com ${credits} crédito(s)`);
  
  const response = await makeRequest('PUT', fullEndpoint, {
    action: 1,
    credits: credits,
    reg_password: auth.cryptPass
  }, auth.token);
  
  console.log('[Uniplay] ✅ Renovação concluída!');
  
  return response;
}

// ========================================
// CRIAR TESTE RÁPIDO (TRIAL)
// ========================================

async function createTrial(account, options = {}) {
  const auth = await getValidToken(account);
  
  const testHours = options.hours || 3;
  const nota = options.nota || 'Teste criado via UniPanel';
  const packageId = options.packageId || '1';
  
  console.log(`[Uniplay] 🧪 Criando teste de ${testHours}h...`);
  
  const payload = {
    isOficial: false,
    package: packageId,
    credits: 1,
    isCustomPackage: false,
    nota: nota,
    test_hours: String(testHours)
  };
  
  const response = await makeRequest('POST', '/api/users-iptv', payload, auth.token);
  
  if (!response.username || !response.password) {
    throw new Error('Resposta inválida - credenciais não recebidas');
  }
  
  console.log(`[Uniplay] ✅ Teste criado! User: ${response.username}`);
  
  return {
    success: true,
    id: response.id,
    username: String(response.username),
    password: response.password,
    expiry: response.exp_date,
    expiryFormatted: response.exp_date_formatted,
    testHours: testHours,
    
    // URLs
    m3u8: response.M3U8,
    m3u8Short: response.short_M3U8,
    m3u8Hls: response.M3U8_2,
    m3u8HlsShort: response.short_M3U8_2,
    
    // DNS
    dnsSmarters: response.DNS_SMARTER,
    
    // Info adicional
    nota: response.nota,
    links: response.links_franchise,
    
    // Raw response
    raw: response
  };
}

// ========================================
// BUSCAR CLIENTE POR NOME
// ========================================

async function findClientByName(account, searchName, serviceType) {
  const search = searchName.trim().toLowerCase();
  let clients = [];
  
  if (serviceType === 'auto' || serviceType === 'p2p') {
    const p2p = await getP2PClients(account);
    clients = clients.concat(p2p);
  }
  
  if (serviceType === 'auto' || serviceType === 'iptv') {
    const iptv = await getIPTVClients(account);
    clients = clients.concat(iptv);
  }
  
  // Busca exata
  const exact = clients.find(function(c) {
    return c.name && c.name.toLowerCase() === search;
  });
  
  if (exact) {
    return { found: true, client: exact, similar: [] };
  }
  
  // Busca similar
  const similar = clients.filter(function(c) {
    if (!c.name) return false;
    const name = c.name.toLowerCase();
    return name.includes(search) || search.includes(name);
  }).slice(0, 10);
  
  return { found: false, client: null, similar: similar };
}

// ========================================
// TESTAR CONEXÃO (LOGIN)
// ========================================

async function testConnection(username, password) {
  try {
    const result = await login(username, password);
    return { 
      success: true, 
      userId: result.userId,
      message: 'Conexão OK!'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// ========================================
// UTILITÁRIOS
// ========================================

function cleanClientName(nota) {
  if (!nota) return '';
  return nota
    .replace(/\\u([0-9a-fA-F]{4})/g, function(_, grp) {
      return String.fromCharCode(parseInt(grp, 16));
    })
    .replace(/Usuário migrado externamente\.\s*Obs:\s*/gi, '')
    .replace(/Obs:\s*/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ========================================
// STATUS DO CACHE
// ========================================

function getCacheStatus() {
  const status = [];
  
  tokenCache.forEach(function(value, accountId) {
    const remaining = Math.max(0, Math.floor((value.expiresAt - Date.now()) / 1000 / 60));
    status.push({
      accountId: accountId,
      cachedAt: value.cachedAt,
      expiresIn: remaining + ' min',
      valid: Date.now() < value.expiresAt
    });
  });
  
  return {
    totalCached: tokenCache.size,
    tokens: status,
    proxyConfigured: !!(process.env.UNIPLAY_PROXY_HOST && process.env.UNIPLAY_PROXY_PORT)
  };
}

// ========================================
// VERIFICAR CONFIGURAÇÃO DO PROXY
// ========================================

function checkProxyConfig() {
  const host = process.env.UNIPLAY_PROXY_HOST;
  const port = process.env.UNIPLAY_PROXY_PORT;
  const user = process.env.UNIPLAY_PROXY_USER;
  const pass = process.env.UNIPLAY_PROXY_PASS;
  
  return {
    configured: !!(host && port),
    host: host || 'NÃO CONFIGURADO',
    port: port || 'NÃO CONFIGURADO',
    hasAuth: !!(user && pass)
  };
}

// ========================================
// OBTER LINKS M3U DO CLIENTE
// ========================================

async function getClientLinks(account, clientId) {
  const auth = await getValidToken(account);
  
  console.log(`[Uniplay] 🔗 Buscando links do cliente ${clientId}...`);
  
  // PUT com action: 8 retorna os links M3U
  const response = await makeRequest('PUT', `/api/users-iptv/${clientId}`, {
    action: 8
  }, auth.token);
  
  console.log(`[Uniplay] ✅ Links obtidos para cliente ${clientId}`);
  
  return {
    m3u8: response.M3U8 || null,
    m3u8_hls: response.M3U8_2 || null,
    short_m3u8: response.short_M3U8 || null,
    raw: response
  };
}

// ========================================
// EXPORTS
// ========================================

export {
  login,
  getValidToken,
  getP2PClients,
  getIPTVClients,
  getAllClients,
  renewClient,
  createTrial,
  findClientByName,
  testConnection,
  getCacheStatus,
  clearCachedToken,
  cleanClientName,
  checkProxyConfig,
  getClientLinks
};

export default {
  login,
  getValidToken,
  getP2PClients,
  getIPTVClients,
  getAllClients,
  renewClient,
  createTrial,
  findClientByName,
  testConnection,
  getCacheStatus,
  clearCachedToken,
  cleanClientName,
  checkProxyConfig,
  getClientLinks
};