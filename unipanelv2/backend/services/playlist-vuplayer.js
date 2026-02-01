// services/playlist-vuplayer.js - Integração com VU Player Pro
import axios from 'axios';

const DOMAIN = process.env.VUPLAYER_DOMAIN || 'vuproplayer.com';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_VUPLAYER_URL;

// ========================================
// LOGIN
// ========================================

async function login(client) {
  const mac_address = (client.mac_address || '').trim();
  const device_key = (client.device_key || '').trim();
  
  if (!mac_address || !device_key) {
    throw new Error('MAC Address e Device Key são obrigatórios para VUPlayer');
  }
  
  if (!CLOUDFLARE_WORKER_URL) {
    throw new Error('CLOUDFLARE_VUPLAYER_URL não configurada no .env');
  }
  
  console.log(`🔐 VUPlayer login: ${mac_address}`);
  console.log(`   📍 Domain: ${DOMAIN}`);
  console.log(`   ☁️ Worker: ${CLOUDFLARE_WORKER_URL}`);
  
  try {
    // ========================================
    // PASSO 1: GET /login para obter sessão inicial
    // ========================================
    console.log(`   📤 Step 1: GET /login (obter sessão)`);
    
    const initResponse = await axios.post(CLOUDFLARE_WORKER_URL, {
      url: `https://${DOMAIN}/login`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    }, { timeout: 15000 });
    
    // Extrair cookie da sessão inicial
    const initCookieHeader = initResponse.data.headers['set-cookie'];
    let sessionCookie = '';
    
    if (Array.isArray(initCookieHeader)) {
      sessionCookie = initCookieHeader[0].split(';')[0];
    } else if (typeof initCookieHeader === 'string') {
      sessionCookie = initCookieHeader.split(';')[0];
    }
    
    console.log(`   🍪 Sessão inicial: ${sessionCookie || 'NENHUMA'}`);
    
    // ========================================
    // PASSO 2: POST /login com credenciais + sessão
    // ========================================
    const params = new URLSearchParams({
      mac_address: mac_address,
      device_key: device_key,
      submit: ''
    });
    
    const postData = params.toString();
    
    console.log(`   📤 Step 2: POST /login (credenciais)`);
    console.log(`   📤 Payload: ${postData}`);
    
    const requestPayload = {
      url: `https://${DOMAIN}/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': `https://${DOMAIN}/login`,
        'Origin': `https://${DOMAIN}`,
        'Cookie': sessionCookie  // CRÍTICO: enviar cookie da sessão inicial
      },
      body: postData
    };
    
    const response = await axios.post(CLOUDFLARE_WORKER_URL, requestPayload, {
      timeout: 60000
    });
    
    const workerData = response.data;
    const statusCode = workerData.status;
    
    console.log(`   📥 Status: ${statusCode}`);
    
    // Extrair cookies
    const setCookieHeader = workerData.headers['set-cookie'];
    let cookies = [];
    
    if (Array.isArray(setCookieHeader)) {
      cookies = setCookieHeader;
    } else if (typeof setCookieHeader === 'string') {
      cookies = [setCookieHeader];
    }
    
    console.log(`   🍪 Cookies recebidos: ${cookies.length}`);
    if (cookies.length > 0) {
      console.log(`   🍪 Cookie completo: ${cookies[0]}`);
    }
    
    // Debug: mostrar body do login
    console.log(`   📄 Login body length: ${workerData.body?.length || 0}`);
    console.log(`   📄 Login body preview: ${workerData.body?.substring(0, 300)}`);
    console.log(`   🔍 Body contains 'Mac Address': ${workerData.body?.includes('Mac Address')}`);
    console.log(`   🔍 Body contains 'Manage Your playlist': ${workerData.body?.includes('Manage Your playlist')}`);
    console.log(`   🔍 Body contains 'activate device': ${workerData.body?.includes('activate device')}`);
    
    // Verificar sucesso
    // O Worker pode ter seguido o redirect automaticamente
    // Caso 1: Status 302 = redirect (worker não seguiu)
    // Caso 2: Status 200 + body contém "Mac Address" = worker seguiu redirect e retornou /mylist
    const loginBody = workerData.body || '';
    const isMylistPage = loginBody.includes('Mac Address :') || loginBody.includes('Mac Address:');
    
    // Extrair cookie - pode vir do response OU usamos o da sessão inicial
    let finalCookie = '';
    if (cookies.length > 0) {
      finalCookie = cookies[0].split(';')[0];
    } else {
      // Worker seguiu redirect e não retornou novo cookie - usar sessão inicial
      finalCookie = sessionCookie;
    }
    
    console.log(`   🍪 Cookie final: ${finalCookie}`);
    
    if (statusCode === 200 && isMylistPage) {
      // Worker seguiu o redirect e retornou a página /mylist - LOGIN OK!
      console.log(`   ✅ Login OK (200 + página /mylist detectada)`);
      console.log(`✅ VUPlayer login OK!`);
      
      return {
        macAddress: mac_address,
        deviceKey: device_key,
        cookie: finalCookie,
        loginTime: new Date().toISOString()
      };
      
    } else if (statusCode === 302 && finalCookie) {
      // Worker não seguiu redirect - precisamos fazer request para /mylist
      const cookie = cookies[0].split(';')[0];
      
      console.log(`   ✅ Login OK (302 redirect), testando /mylist...`);
      console.log(`   🍪 Cookie: ${cookie}`);
      
      // Testar acesso a /mylist para verificar se login funcionou
      try {
        const testResponse = await axios.post(CLOUDFLARE_WORKER_URL, {
          url: `https://${DOMAIN}/mylist`,
          method: 'GET',
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Referer': `https://${DOMAIN}/login`
          }
        }, { timeout: 15000 });
        
        const mylistHtml = testResponse.data.body;
        const mylistStatus = testResponse.data.status;
        
        console.log(`   📥 /mylist status: ${mylistStatus}`);
        
        if (typeof mylistHtml === 'string' && (mylistHtml.includes('Mac Address :') || mylistHtml.includes('Mac Address:'))) {
          console.log(`✅ VUPlayer login OK!`);
          
          return {
            macAddress: mac_address,
            deviceKey: device_key,
            cookie: cookie,
            loginTime: new Date().toISOString()
          };
        } else {
          console.log(`   ❌ Cookie inválido - /mylist não acessível`);
          console.log(`   📄 HTML length: ${mylistHtml?.length || 0}`);
          console.log(`   📄 HTML preview: ${mylistHtml?.substring(0, 500)}`);
          throw new Error('Login falhou - credenciais inválidas');
        }
      } catch (testError) {
        console.error(`   ❌ Erro ao testar /mylist: ${testError.message}`);
        throw new Error('Login falhou - não foi possível verificar acesso');
      }
      
    } else if (statusCode === 200) {
      // Status 200 mas NÃO é página /mylist = login falhou
      console.log(`   ❌ Login falhou (200) - credenciais rejeitadas ou formato inválido`);
      
      // Verificar se tem mensagem de erro no HTML
      const hasError = workerData.body?.includes('error') || 
                       workerData.body?.includes('invalid') ||
                       workerData.body?.includes('incorrect');
      if (hasError) {
        console.log(`   📄 HTML contém mensagem de erro`);
      }
      
      throw new Error('Login falhou - MAC Address ou Device Key incorretos');
    } else {
      console.log(`   ❌ Login falhou. Status: ${statusCode}, Cookies: ${cookies.length}`);
      throw new Error('Login falhou - servidor indisponível');
    }
  } catch (error) {
    if (error.message.includes('Login falhou')) {
      throw error;
    }
    console.error(`❌ VUPlayer login erro: ${error.message}`);
    throw new Error(`Erro ao fazer login VUPlayer: ${error.message}`);
  }
}

// ========================================
// REQUISIÇÕES VIA WORKER
// ========================================

async function makeRequest(method, path, cookie, data = null) {
  if (!CLOUDFLARE_WORKER_URL) {
    throw new Error('CLOUDFLARE_VUPLAYER_URL não configurada');
  }
  
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': method === 'GET' ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': `https://${DOMAIN}/mylist`
  };

  if (data) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Origin'] = `https://${DOMAIN}`;
  }

  const response = await axios.post(CLOUDFLARE_WORKER_URL, {
    url: `https://${DOMAIN}${path}`,
    method: method,
    headers: headers,
    body: data ? data.toString() : undefined
  }, { timeout: 15000 });
  
  const workerData = response.data;
  
  if (workerData.status === 200) {
    return workerData.body;
  } else {
    throw new Error(`Erro HTTP ${workerData.status}`);
  }
}

// ========================================
// PARSER HTML
// ========================================

function parsePlaylistsHTML(html) {
  const playlists = [];
  
  // Verificar se é página autenticada (pode ter "Mac Address :" ou "Mac Address:")
  const isMylistPage = (html.includes('Mac Address :') || html.includes('Mac Address:')) && 
                       (html.includes('Device Key :') || html.includes('Device Key:'));
  
  if (!isMylistPage) {
    throw new Error('Sessão inválida - não autenticado');
  }
  
  // Procurar tbody da tabela de playlists
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  
  if (!tbodyMatch) {
    // Pode não ter playlists ainda
    console.log('   ⚠️ Nenhuma playlist encontrada (tbody vazio)');
    return [];
  }
  
  const tbody = tbodyMatch[1];
  
  // Regex para extrair cada linha da tabela
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1];
    
    // Extrair células
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Limpar HTML das células
      let cellContent = cellMatch[1]
        .replace(/<[^>]+>/g, '') // Remove tags HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(cellContent);
    }
    
    // Extrair ID do botão de editar/deletar (VUPlayer usa data-current_id)
    const idMatch = row.match(/data-current_id="([^"]+)"/) || 
                    row.match(/data-id="([^"]+)"/);
    const id = idMatch ? idMatch[1] : null;
    
    // Extrair tipo da playlist
    const typeMatch = row.match(/data-playlist_type="([^"]+)"/);
    const playlistType = typeMatch ? typeMatch[1] : 'general';
    
    // Verificar se é protegida
    const protectedMatch = row.match(/data-protected="([^"]+)"/);
    const isProtected = protectedMatch ? protectedMatch[1] === '1' : false;
    
    // Extrair URL do input hidden ou do texto da célula
    const urlMatch = row.match(/value="(https?:\/\/[^"]+)"/i) || 
                     row.match(/(https?:\/\/[^\s<"]+)/i);
    const url = urlMatch ? urlMatch[1] : (cells[1] || '');
    
    if (id && cells.length >= 1) {
      playlists.push({
        id: id,
        name: cells[0] || 'Sem nome',
        url: url,
        type: playlistType,
        is_protected: isProtected,
        pin: ''
      });
    }
  }
  
  return playlists;
}

// ========================================
// LISTAR PLAYLISTS
// ========================================

async function listPlaylists(session) {
  console.log(`🔍 VUPlayer listPlaylists: ${session.macAddress}`);
  
  const html = await makeRequest('GET', '/mylist', session.cookie);
  
  const playlists = parsePlaylistsHTML(html);
  
  console.log(`✅ VUPlayer: ${playlists.length} playlist(s) encontrada(s)`);
  
  return playlists;
}

// ========================================
// ADICIONAR PLAYLIST
// ========================================

async function addPlaylist(session, options) {
  const { name, url, pin = '', protect = false, type = 'general' } = options;
  
  console.log(`➕ VUPlayer addPlaylist: ${name}`);
  
  const params = new URLSearchParams({
    current_playlist_url_id: '-1',
    playlist_name: name,
    playlist_url: url,
    protect: protect ? '1' : '0',
    pin: protect ? pin : '',
    playlist_type: type,
    user_name: '',
    password: ''
  });

  const response = await makeRequest('POST', '/savePlaylist', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      console.log(`✅ VUPlayer playlist adicionada`);
      return result.data;
    } else {
      throw new Error(result.msg || 'Erro ao adicionar playlist');
    }
  } catch (error) {
    if (error.message.includes('Erro ao adicionar')) {
      throw error;
    }
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

// ========================================
// EDITAR PLAYLIST
// ========================================

async function editPlaylist(session, playlistId, options) {
  const { name, url, pin = '', protect = false, type = 'general' } = options;
  
  console.log(`✏️ VUPlayer editPlaylist: ${playlistId}`);
  
  const params = new URLSearchParams({
    current_playlist_url_id: playlistId,
    playlist_name: name,
    playlist_url: url,
    protect: protect ? '1' : '0',
    pin: protect ? pin : '',
    playlist_type: type,
    user_name: '',
    password: ''
  });

  const response = await makeRequest('POST', '/savePlaylist', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      console.log(`✅ VUPlayer playlist editada`);
      return result.data;
    } else {
      throw new Error(result.msg || result.message || 'Erro ao editar playlist');
    }
  } catch (error) {
    if (error.message.includes('Erro ao editar')) {
      throw error;
    }
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

// ========================================
// DELETAR PLAYLIST
// ========================================

async function deletePlaylist(session, playlistId) {
  console.log(`🗑️ VUPlayer deletePlaylist: ${playlistId}`);
  
  const params = new URLSearchParams({
    playlist_url_id: playlistId
  });
  
  const response = await makeRequest('DELETE', '/deletePlayListUrl', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      console.log(`✅ VUPlayer playlist deletada`);
      return result;
    } else {
      throw new Error(result.msg || result.message || 'Erro ao deletar playlist');
    }
  } catch (error) {
    if (error.message.includes('Erro ao deletar')) {
      throw error;
    }
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

// ========================================
// TESTAR SESSÃO
// ========================================

async function testSession(session) {
  try {
    const html = await makeRequest('GET', '/mylist', session.cookie);
    return html.includes('Mac Address :') || html.includes('Mac Address:');
  } catch (error) {
    return false;
  }
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
  testSession
};

export default {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist,
  testSession
};
