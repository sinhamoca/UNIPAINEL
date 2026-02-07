// services/playlist-ibopro.js - Integração com IBOPro
import https from 'https';
import pkg from 'js-sha3';
const { sha3_512 } = pkg;

const API_BASE = process.env.IBOPRO_API_BASE || 'api.iboproapp.com';

// ========================================
// FUNÇÕES DE HASH (algoritmo específico do IBOPro)
// ========================================

function F(t) {
  if (t.length >= 6) {
    return t.substring(0, 3) + "iBo" + t.substring(3, t.length - 3) + "PrO" + t.substring(t.length - 3, t.length);
  }
  if (t.length >= 3) {
    return t.substring(0, 3) + "iBo" + t.substring(3);
  }
  return t + "PrO";
}

function T(t) {
  const encoded = F(t);
  return F(Buffer.from(encoded).toString('base64'));
}

async function L(e) {
  const n = Date.now().toString();
  const o = T(e + n);
  const normalized = o.normalize();
  const r = sha3_512(normalized);
  return T(r + n);
}

async function generateAllTokens(mac, password) {
  const timestamp = Date.now();
  mac = mac || '';
  password = password || '';
  
  const gcToken = await L(`${mac}${timestamp}${2 * timestamp}`);
  const hash1 = await L(`${mac}___${password}`);
  const hash2 = await L(`${mac}___${password}__${timestamp}`);
  const token1 = await L(`${mac}${timestamp}`);
  const token2 = await L(mac);
  const token3 = T(mac);
  
  return {
    'X-Gc-Token': gcToken,
    'x-hash': hash1,
    'x-hash-2': hash2,
    'x-token': token1,
    'x-token-2': token2,
    'x-token-3': token3
  };
}

// ========================================
// REQUISIÇÕES HTTP
// ========================================

function makeRequest(method, path, tokens, data = null, sessionToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      port: 443,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': 'https://iboplayer.pro',
        'Referer': 'https://iboplayer.pro/',
        'Authorization': sessionToken ? `Bearer ${sessionToken}` : 'Bearer',
        ...tokens
      }
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = https.request(options, (res) => {
      let response = '';
      
      res.on('data', (chunk) => {
        response += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(response));
          } catch (e) {
            resolve(response);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${response}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// ========================================
// LOGIN
// ========================================

async function login(client) {
  const { mac_address, password } = client;
  
  if (!mac_address || !password) {
    throw new Error('MAC Address e Password são obrigatórios para IBOPro');
  }
  
  console.log(`🔐 IBOPro login: ${mac_address}`);
  
  const tokens = await generateAllTokens(mac_address, password);
  
  try {
    const response = await makeRequest('POST', '/auth/login', tokens, {
      mac: mac_address,
      password: password
    });
    
    if (!response.status || !response.token) {
      throw new Error('Login falhou: ' + (response.message || 'Token não recebido'));
    }
    
    console.log(`✅ IBOPro login OK!`);
    
    return {
      macAddress: mac_address,
      password: password,
      token: response.token,
      loginTime: new Date().toISOString(),
      userData: response.user
    };
    
  } catch (error) {
    console.error(`❌ IBOPro login falhou: ${error.message}`);
    throw new Error(`Erro ao fazer login IBOPro: ${error.message}`);
  }
}

// ========================================
// LISTAR PLAYLISTS
// ========================================

async function listPlaylists(session) {
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  console.log(`🔍 IBOPro listPlaylists: ${session.macAddress}`);
  
  const response = await makeRequest('GET', '/playlistw', tokens, null, session.token);
  
  // A resposta é um array direto
  if (!Array.isArray(response)) {
    console.log('⚠️ IBOPro: Resposta não é array:', typeof response);
    return [];
  }
  
  console.log(`✅ IBOPro: ${response.length} playlist(s) encontrada(s)`);
  
  return response.map(p => ({
    id: p.id || p._id,
    name: p.name || p.playlist_name || 'Sem nome',
    url: p.url || p.playlist_url || '',
    type: p.type || p.playlist_type || 'URL',
    is_protected: p.is_protected === true || p.is_protected === 1,
    pin: p.pin || ''
  }));
}

// ========================================
// ADICIONAR PLAYLIST
// ========================================

async function addPlaylist(session, options) {
  const { name, url, pin = '', protect = false, type = 'URL' } = options;
  
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  const payload = {
    mac_address: session.macAddress,
    playlist_name: name,
    playlist_url: url,
    playlist_type: type,
    type: type,
    is_protected: protect,
    pin: pin,
    playlist_id: null,
    playlist_host: '',
    playlist_username: '',
    playlist_password: ''
  };
  
  console.log(`➕ IBOPro addPlaylist: ${name}`);
  
  const response = await makeRequest('POST', '/playlistw', tokens, payload, session.token);
  
  console.log(`✅ IBOPro playlist adicionada`);
  
  return response;
}

// ========================================
// EDITAR PLAYLIST
// ========================================

async function editPlaylist(session, playlistId, options) {
  const { name, url, pin = '', protect = false, type = 'URL' } = options;
  
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  const payload = {
    mac_address: session.macAddress,
    playlist_id: playlistId,
    playlist_name: name,
    playlist_url: url,
    playlist_type: type,
    type: type,
    is_protected: protect,
    pin: pin,
    playlist_host: '',
    playlist_username: '',
    playlist_password: ''
  };
  
  console.log(`✏️ IBOPro editPlaylist: ${playlistId}`);
  
  const response = await makeRequest('POST', '/playlistw', tokens, payload, session.token);
  
  console.log(`✅ IBOPro playlist editada`);
  
  return response;
}

// ========================================
// DELETAR PLAYLIST
// ========================================

async function deletePlaylist(session, playlistId, pin = '') {
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  const data = {
    mac_address: session.macAddress,
    playlist_id: playlistId
  };
  
  console.log(`🗑️ IBOPro deletePlaylist: ${playlistId}`);
  
  const response = await makeRequest('DELETE', '/playlistw', tokens, data, session.token);
  
  console.log(`✅ IBOPro playlist deletada`);
  
  return response;
}

// ========================================
// EXPORTS
// ========================================

export {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist,
  generateAllTokens
};

export default {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist,
  generateAllTokens
};
