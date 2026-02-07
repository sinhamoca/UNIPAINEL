// routes/workflows.js
// Rotas para gerenciar e executar workflows integrados
import express from 'express';
import { run, get, all } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

// Importar serviços
import { getKofficeClient } from '../services/koffice/index.js';
import GerenciaClient from '../services/gerencia-client.js';
import { getSigmaClient } from '../services/sigma/index.js';
import uniplayService from '../services/uniplay/index.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// ==================== CONTAS DISPONÍVEIS ====================
// IMPORTANTE: Estas rotas devem vir ANTES das rotas com :id

// GET /api/workflows/accounts/koffice - Listar contas Koffice disponíveis
router.get('/accounts/koffice', (req, res) => {
  try {
    const accounts = all(
      `SELECT id, name, domain FROM koffice_accounts WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/accounts/ibo - Listar contas IBO Revenda disponíveis
router.get('/accounts/ibo', (req, res) => {
  try {
    const accounts = all(
      `SELECT id, name, email FROM gerencia_accounts WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/accounts/sigma - Listar contas Sigma disponíveis
router.get('/accounts/sigma', (req, res) => {
  try {
    // Nota: sigma_accounts pode não ter user_id, então listamos todas
    const accounts = all(
      `SELECT id, name, domain FROM sigma_accounts`
    );
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/accounts/sigma/:id/packages - Listar pacotes trial do Sigma
router.get('/accounts/sigma/:id/packages', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = get('SELECT * FROM sigma_accounts WHERE id = ?', [id]);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta Sigma não encontrada' });
    }
    
    console.log(`[Workflow] Buscando pacotes trial do Sigma (conta ${id})...`);
    
    const sigmaClient = getSigmaClient(account);
    const { servers, packages } = await sigmaClient.getServersAndPackages();
    
    // Filtrar apenas pacotes trial
    const trialPackages = packages.filter(pkg => pkg.is_trial === true);
    
    console.log(`[Workflow] ${trialPackages.length} pacotes trial encontrados`);
    
    res.json({
      success: true,
      servers,
      packages: trialPackages
    });
  } catch (error) {
    console.error('Erro ao buscar pacotes Sigma:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/accounts/uniplay
router.get('/accounts/uniplay', (req, res) => {
  try {
    const accounts = all(
      `SELECT id, name, username FROM uniplay_accounts WHERE user_id = ? AND is_active = 1`,
      [req.user.id]
    );
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PANEL-PLAYLIST-SYNC CONFIG ====================

// GET /api/workflows/panel-playlist-sync/config - Obter configuração
router.get('/panel-playlist-sync/config', (req, res) => {
  try {
    const config = get(`
      SELECT * FROM workflow_panel_playlist_sync_config 
      WHERE user_id = ?
    `, [req.user.id]);
    
    res.json({ 
      success: true, 
      config: config || null 
    });
  } catch (error) {
    console.error('Erro ao obter config panel-playlist-sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/workflows/panel-playlist-sync/config - Salvar configuração
router.post('/panel-playlist-sync/config', (req, res) => {
  try {
    const { koffice_account_id, sigma_account_id, uniplay_account_id } = req.body;
    
    // Verificar se já existe config
    const existing = get(`
      SELECT id FROM workflow_panel_playlist_sync_config 
      WHERE user_id = ?
    `, [req.user.id]);
    
    if (existing) {
      // Update
      run(`
        UPDATE workflow_panel_playlist_sync_config 
        SET koffice_account_id = ?,
            sigma_account_id = ?,
            uniplay_account_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [
        koffice_account_id || null,
        sigma_account_id || null,
        uniplay_account_id || null,
        req.user.id
      ]);
    } else {
      // Insert
      run(`
        INSERT INTO workflow_panel_playlist_sync_config 
        (user_id, koffice_account_id, sigma_account_id, uniplay_account_id)
        VALUES (?, ?, ?, ?)
      `, [
        req.user.id,
        koffice_account_id || null,
        sigma_account_id || null,
        uniplay_account_id || null
      ]);
    }
    
    // Retornar config atualizada
    const config = get(`
      SELECT * FROM workflow_panel_playlist_sync_config 
      WHERE user_id = ?
    `, [req.user.id]);
    
    res.json({ 
      success: true, 
      config,
      message: 'Configuração salva!' 
    });
  } catch (error) {
    console.error('Erro ao salvar config panel-playlist-sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD DE WORKFLOWS ====================

// GET /api/workflows - Listar workflows do usuário
router.get('/', (req, res) => {
  try {
    const workflows = all(
      `SELECT * FROM workflows WHERE user_id = ? AND is_active = 1 ORDER BY use_count DESC, created_at DESC`,
      [req.user.id]
    );
    
    // Parse config JSON
    const parsed = workflows.map(w => ({
      ...w,
      config: JSON.parse(w.config || '{}')
    }));
    
    res.json({ success: true, workflows: parsed });
  } catch (error) {
    console.error('Erro ao listar workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/workflows - Criar workflow
router.post('/', (req, res) => {
  try {
    const { name, type, description, config } = req.body;
    
    if (!name || !type || !config) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome, tipo e configuração são obrigatórios' 
      });
    }
    
    // Validar tipo
    const validTypes = ['koffice_ibo', 'sigma_ibo', 'uniplay_ibo'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tipo de workflow inválido' 
      });
    }
    
    run(
      `INSERT INTO workflows (user_id, name, type, description, config) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, name, type, description || '', JSON.stringify(config)]
    );
    
    const workflow = get(
      `SELECT * FROM workflows WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    
    workflow.config = JSON.parse(workflow.config || '{}');
    
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Erro ao criar workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/:id - Obter workflow específico
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const workflow = get(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    }
    
    workflow.config = JSON.parse(workflow.config || '{}');
    
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Erro ao obter workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workflows/:id - Atualizar workflow
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, config } = req.body;
    
    const workflow = get(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    }
    
    // Preparar config JSON
    let configJson = workflow.config;
    if (config) {
      configJson = JSON.stringify(config);
    }
    
    run(
      `UPDATE workflows SET name = ?, description = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name || workflow.name, description || workflow.description, configJson, id]
    );
    
    const updated = get(`SELECT * FROM workflows WHERE id = ?`, [id]);
    updated.config = JSON.parse(updated.config || '{}');
    
    res.json({ success: true, workflow: updated });
  } catch (error) {
    console.error('Erro ao atualizar workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/workflows/:id - Excluir workflow
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const workflow = get(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    }
    
    run(`DELETE FROM workflows WHERE id = ?`, [id]);
    
    res.json({ success: true, message: 'Workflow excluído' });
  } catch (error) {
    console.error('Erro ao excluir workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== EXECUÇÃO DE WORKFLOWS ====================

// POST /api/workflows/:id/execute - Executar workflow
router.post('/:id/execute', async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  try {
    const workflow = get(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    }
    
    const config = JSON.parse(workflow.config || '{}');
    const inputData = req.body;
    
    let result;
    
    // Executar baseado no tipo
    switch (workflow.type) {
      case 'koffice_ibo':
        result = await executeKofficeIboWorkflow(config, inputData, req.user.id);
        break;
      case 'sigma_ibo':
        result = await executeSigmaIboWorkflow(config, inputData, req.user.id);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Tipo de workflow não suportado' });
      case 'uniplay_ibo':
        result = await executeUniplayIboWorkflow(config, inputData, req.user.id);
        break;
    }
    
    const duration = Date.now() - startTime;
    
    // Atualizar contador de uso
    run(
      `UPDATE workflows SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    
    // Salvar log
    run(
      `INSERT INTO workflow_logs (workflow_id, user_id, status, input_data, output_data, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, 'success', JSON.stringify(inputData), JSON.stringify(result), duration]
    );
    
    res.json({ 
      success: true, 
      result,
      duration_ms: duration
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Erro ao executar workflow:', error);
    
    // Salvar log de erro
    run(
      `INSERT INTO workflow_logs (workflow_id, user_id, status, input_data, error_message, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, 'error', JSON.stringify(req.body), error.message, duration]
    );
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workflows/:id/logs - Logs de execução do workflow
router.get('/:id/logs', (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const workflow = get(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    }
    
    const logs = all(
      `SELECT * FROM workflow_logs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT ?`,
      [id, parseInt(limit)]
    );
    
    // Parse JSON fields
    const parsed = logs.map(log => ({
      ...log,
      input_data: JSON.parse(log.input_data || '{}'),
      output_data: JSON.parse(log.output_data || '{}')
    }));
    
    res.json({ success: true, logs: parsed });
  } catch (error) {
    console.error('Erro ao obter logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== IMPLEMENTAÇÃO DOS WORKFLOWS ====================

/**
 * Workflow: Koffice + IBO Revenda
 * 1. Gera teste no Koffice
 * 2. Cria cliente no IBO Revenda com a playlist do Koffice
 */
async function executeKofficeIboWorkflow(config, inputData, userId) {
  const { koffice_account_id, ibo_account_id } = config;
  let { name, mac_address } = inputData;
  
  if (!name || !mac_address) {
    throw new Error('Nome e MAC Address são obrigatórios');
  }
  
  // Formatar MAC Address automaticamente
  mac_address = formatMacAddress(mac_address);
  
  console.log(`[Workflow] Koffice+IBO: Iniciando...`);
  console.log(`[Workflow] Koffice Account: ${koffice_account_id}, IBO Account: ${ibo_account_id}`);
  console.log(`[Workflow] Input: Nome=${name}, MAC=${mac_address}`);
  
  // 1. Obter conta Koffice
  const kofficeAccount = get(
    `SELECT * FROM koffice_accounts WHERE id = ? AND user_id = ?`,
    [koffice_account_id, userId]
  );
  
  if (!kofficeAccount) {
    throw new Error('Conta Koffice não encontrada');
  }
  
  // 2. Obter conta IBO Revenda
  const iboAccount = get(
    `SELECT * FROM gerencia_accounts WHERE id = ? AND user_id = ?`,
    [ibo_account_id, userId]
  );
  
  if (!iboAccount) {
    throw new Error('Conta IBO Revenda não encontrada');
  }
  
  // 3. Criar teste no Koffice
  console.log(`[Workflow] Gerando teste no Koffice...`);
  const kofficeClient = getKofficeClient(kofficeAccount);
  const testResult = await kofficeClient.createFastTest();
  
  if (!testResult.success) {
    throw new Error(`Erro ao criar teste no Koffice: ${testResult.error}`);
  }
  
  // Log da rawMessage para debug
  if (testResult.rawMessage) {
    console.log(`[Workflow] rawMessage do Koffice:`, testResult.rawMessage);
  }
  
  // Tentar extrair M3U de várias formas
  let playlistUrl = testResult.m3uUrl;
  
  // Fallback 1: Extrair da rawMessage com múltiplos padrões (PRIORITÁRIO)
  if (!playlistUrl && testResult.rawMessage) {
    const message = testResult.rawMessage;
    
    // Padrões possíveis para encontrar URL M3U
    // O formato do Koffice é: "TS -   http://ded35.com/get.php?..."
    const patterns = [
      /TS\s*[-:]\s*(https?:\/\/[^\s<\n]+)/i,           // TS -   http://... ou TS: http://...
      /(https?:\/\/[^\s<\n]+get\.php[^\s<\n]*)/i,      // http://...get.php?...
      /(https?:\/\/[^\s<\n]+type=m3u[^\s<\n]*)/i,      // http://...type=m3u...
      /M3U[:\s]+(https?:\/\/[^\s<\n]+)/i,              // M3U: http://...
      /m3u8?[:\s]+(https?:\/\/[^\s<\n]+)/i,            // m3u: http://... ou m3u8: http://...
      /(https?:\/\/[^\s<\n]+\.m3u8?[^\s<\n]*)/i,       // http://....m3u ou .m3u8
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        playlistUrl = match[1].trim();
        console.log(`[Workflow] URL encontrada via regex: ${playlistUrl}`);
        break;
      }
    }
  }
  
  // Fallback 2: shortUrl (SS) - ÚLTIMO RECURSO
  if (!playlistUrl && testResult.shortUrl) {
    console.log(`[Workflow] Usando shortUrl como último recurso: ${testResult.shortUrl}`);
    playlistUrl = testResult.shortUrl;
  }
  
  console.log(`[Workflow] Teste criado: User=${testResult.user}, Playlist=${playlistUrl}`);
  
  // Verificar se temos a URL
  if (!playlistUrl) {
    throw new Error('Koffice não retornou URL da playlist. Verifique os logs para ver a rawMessage.');
  }
  
  // 4. Criar cliente no IBO Revenda
  console.log(`[Workflow] Criando cliente no IBO Revenda...`);
  
  // Calcular data de expiração (365 dias)
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 365);
  const expireDateStr = expireDate.toISOString().split('T')[0];
  
  // IMPORTANTE: GerenciaClient espera o ID, não o objeto
  const gerenciaClient = new GerenciaClient(iboAccount.id);
  await gerenciaClient.init();
  
  const createResult = await gerenciaClient.createUser({
    server_name: name,
    mac_device: mac_address,
    m3u8_list: playlistUrl,
    expire_date: expireDateStr
  });
  
  if (!createResult.success) {
    throw new Error(`Erro ao criar cliente no IBO: ${createResult.error}`);
  }
  
  console.log(`[Workflow] Cliente criado com sucesso no IBO!`);
  
  return {
    koffice_test: {
      user: testResult.user,
      password: testResult.password,
      validUntil: testResult.validUntil,
      m3uUrl: playlistUrl,
      shortUrl: testResult.shortUrl
    },
    ibo_client: {
      name: name,
      mac_address: mac_address,
      playlist: playlistUrl,
      expire_date: expireDateStr
    },
    message: `Cliente "${name}" criado com sucesso! Playlist do Koffice vinculada.`
  };
}

/**
 * Workflow: Sigma + IBO Revenda
 * 1. Gera teste trial no Sigma com pacote pré-configurado
 * 2. Cria cliente no IBO Revenda com a playlist do Sigma
 */
async function executeSigmaIboWorkflow(config, inputData, userId) {
  const { sigma_account_id, ibo_account_id, default_package_id, default_server_id } = config;
  let { name, mac_address } = inputData;
  
  if (!name || !mac_address) {
    throw new Error('Nome e MAC Address são obrigatórios');
  }
  
  // Validar configuração do workflow
  if (!default_package_id || !default_server_id) {
    throw new Error('Pacote padrão não configurado no workflow. Edite o workflow e selecione um pacote trial.');
  }
  
  // Formatar MAC Address automaticamente
  mac_address = formatMacAddress(mac_address);
  
  console.log(`[Workflow] Sigma+IBO: Iniciando...`);
  console.log(`[Workflow] Sigma Account: ${sigma_account_id}, IBO Account: ${ibo_account_id}`);
  console.log(`[Workflow] Input: Nome=${name}, MAC=${mac_address}`);
  
  // 1. Obter conta Sigma
  const sigmaAccount = get(
    `SELECT * FROM sigma_accounts WHERE id = ?`,
    [sigma_account_id]
  );
  
  if (!sigmaAccount) {
    throw new Error('Conta Sigma não encontrada');
  }
  
  // 2. Obter conta IBO Revenda
  const iboAccount = get(
    `SELECT * FROM gerencia_accounts WHERE id = ? AND user_id = ?`,
    [ibo_account_id, userId]
  );
  
  if (!iboAccount) {
    throw new Error('Conta IBO Revenda não encontrada');
  }
  
  // 3. Buscar informações do pacote para obter trial_hours correto
  console.log(`[Workflow] Buscando informações do pacote ${default_package_id}...`);
  const sigmaClient = getSigmaClient(sigmaAccount);
  
  const { packages } = await sigmaClient.getServersAndPackages();
  const selectedPackage = packages.find(p => p.id === default_package_id);
  
  // Usar trial_hours do pacote, ou duration, ou fallback para 2
  const trial_hours = selectedPackage?.trial_hours || selectedPackage?.duration || 2;
  
  console.log(`[Workflow] Pacote: ${default_package_id}, Servidor: ${default_server_id}, Horas: ${trial_hours}`);
  
  // 4. Criar teste trial no Sigma
  console.log(`[Workflow] Gerando teste trial no Sigma...`);
  
  const testResult = await sigmaClient.createTrialCustomer(
    default_server_id,
    default_package_id,
    trial_hours,
    1 // connections
  );
  
  // Verificar sucesso
  if (!testResult.success && !testResult.customer) {
    throw new Error(`Erro ao criar teste no Sigma: ${testResult.error || 'Falha desconhecida'}`);
  }
  
  const customer = testResult.customer;
  const playlist = testResult.playlist;
  
  console.log(`[Workflow] Teste Sigma criado:`, JSON.stringify({ customer, playlist }, null, 2));
  
  // Extrair M3U URL da playlist
  let playlistUrl = null;
  
  // Tentar várias formas de obter a URL
  if (playlist?.m3u_url) {
    playlistUrl = playlist.m3u_url;
  } else if (playlist?.url) {
    playlistUrl = playlist.url;
  } else if (playlist?.playlist_url) {
    playlistUrl = playlist.playlist_url;
  } else if (customer?.playlist_url) {
    playlistUrl = customer.playlist_url;
  } else if (customer?.m3u_url) {
    playlistUrl = customer.m3u_url;
  }
  
  // Se ainda não tem URL, tentar buscar playlist do cliente
  if (!playlistUrl && customer?.id) {
    console.log(`[Workflow] Buscando playlist do cliente ${customer.id}...`);
    try {
      const customerPlaylist = await sigmaClient.getCustomerPlaylist(customer.id);
      console.log(`[Workflow] Playlist retornada:`, JSON.stringify(customerPlaylist, null, 2));
      
      if (customerPlaylist?.m3u_url) {
        playlistUrl = customerPlaylist.m3u_url;
      } else if (customerPlaylist?.url) {
        playlistUrl = customerPlaylist.url;
      } else if (customerPlaylist?.playlist_url) {
        playlistUrl = customerPlaylist.playlist_url;
      } else if (typeof customerPlaylist === 'string' && customerPlaylist.startsWith('http')) {
        playlistUrl = customerPlaylist;
      }
    } catch (playlistError) {
      console.log(`[Workflow] Erro ao buscar playlist:`, playlistError.message);
    }
  }
  
  // Último fallback: construir URL manualmente se temos username/password
  if (!playlistUrl && customer?.username && customer?.password) {
    // Tentar construir URL M3U padrão
    const domain = sigmaAccount.domain.replace(/\/$/, '');
    playlistUrl = `${domain}/get.php?username=${customer.username}&password=${customer.password}&type=m3u_plus&output=ts`;
    console.log(`[Workflow] URL construída manualmente: ${playlistUrl}`);
  }
  
  console.log(`[Workflow] Teste criado: User=${customer?.username}, Playlist=${playlistUrl}`);
  
  // Verificar se temos a URL
  if (!playlistUrl) {
    throw new Error('Sigma não retornou URL da playlist. Verifique os logs para debug.');
  }
  
  // 4. Criar cliente no IBO Revenda
  console.log(`[Workflow] Criando cliente no IBO Revenda...`);
  
  // Calcular data de expiração (365 dias)
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 365);
  const expireDateStr = expireDate.toISOString().split('T')[0];
  
  const gerenciaClient = new GerenciaClient(iboAccount.id);
  await gerenciaClient.init();
  
  const createResult = await gerenciaClient.createUser({
    server_name: name,
    mac_device: mac_address,
    m3u8_list: playlistUrl,
    expire_date: expireDateStr
  });
  
  if (!createResult.success) {
    throw new Error(`Erro ao criar cliente no IBO: ${createResult.error}`);
  }
  
  console.log(`[Workflow] Cliente criado com sucesso no IBO!`);
  
  return {
    sigma_test: {
      id: customer?.id,
      username: customer?.username,
      password: customer?.password,
      validUntil: customer?.expires_at || customer?.expire_date,
      m3uUrl: playlistUrl
    },
    ibo_client: {
      name: name,
      mac_address: mac_address,
      playlist: playlistUrl,
      expire_date: expireDateStr
    },
    message: `Cliente "${name}" criado com sucesso! Playlist do Sigma vinculada.`
  };
}

/**
 * Formata MAC Address para o padrão XX:XX:XX:XX:XX:XX
 */
function formatMacAddress(mac) {
  // Remove todos os caracteres que não são hexadecimais
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  
  // Verificar se tem 12 caracteres (6 bytes)
  if (cleaned.length !== 12) {
    // Retorna como está se não tiver o tamanho correto
    return mac;
  }
  
  // Formatar com dois pontos
  return cleaned.match(/.{2}/g).join(':');
}

/**
 * Workflow: Uniplay + IBO Revenda
 * 1. Gera teste no Uniplay usando uniplayService.createTrial()
 * 2. Captura a URL M3U8 da playlist
 * 3. Cria cliente no IBO Revenda com a playlist
 */
async function executeUniplayIboWorkflow(config, inputData, userId) {
  const { uniplay_account_id, ibo_account_id, trial_hours = 3 } = config;
  let { name, mac_address } = inputData;
  
  if (!name || !mac_address) {
    throw new Error('Nome e MAC Address são obrigatórios');
  }
  
  // Formatar MAC Address automaticamente
  mac_address = formatMacAddress(mac_address);
  
  console.log(`[Workflow] Uniplay+IBO: Iniciando...`);
  console.log(`[Workflow] Uniplay Account: ${uniplay_account_id}, IBO Account: ${ibo_account_id}`);
  console.log(`[Workflow] Trial Hours: ${trial_hours}`);
  console.log(`[Workflow] Input: Nome=${name}, MAC=${mac_address}`);
  
  // 1. Obter conta Uniplay
  const uniplayAccount = get(
    `SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ? AND is_active = 1`,
    [uniplay_account_id, userId]
  );
  
  if (!uniplayAccount) {
    throw new Error('Conta Uniplay não encontrada');
  }
  
  // 2. Obter conta IBO Revenda
  const iboAccount = get(
    `SELECT * FROM gerencia_accounts WHERE id = ? AND user_id = ?`,
    [ibo_account_id, userId]
  );
  
  if (!iboAccount) {
    throw new Error('Conta IBO Revenda não encontrada');
  }
  
  // 3. Criar teste no Uniplay usando o serviço existente
  console.log(`[Workflow] Gerando teste no Uniplay (${trial_hours}h)...`);
  
  const trialResult = await uniplayService.createTrial(uniplayAccount, {
    hours: trial_hours,
    nota: `Workflow: ${name} - MAC: ${mac_address}`,
    packageId: '1'
  });
  
  console.log(`[Workflow] Resultado do teste Uniplay:`, JSON.stringify(trialResult, null, 2));
  
  // 4. Extrair M3U8 URL - campo correto é 'm3u8'
  const playlistUrl = trialResult.m3u8;
  
  if (!playlistUrl) {
    console.error('[Workflow] trialResult não contém m3u8:', Object.keys(trialResult));
    throw new Error('Uniplay não retornou URL da playlist M3U8');
  }
  
  console.log(`[Workflow] Teste criado: User=${trialResult.username}, M3U8=${playlistUrl}`);
  
  // 5. Criar cliente no IBO Revenda
  console.log(`[Workflow] Criando cliente no IBO Revenda...`);
  
  // Calcular data de expiração (365 dias)
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 365);
  const expireDateStr = expireDate.toISOString().split('T')[0];
  
  const gerenciaClient = new GerenciaClient(iboAccount.id);
  await gerenciaClient.init();
  
  const createResult = await gerenciaClient.createUser({
    server_name: name,
    mac_device: mac_address,
    m3u8_list: playlistUrl,
    expire_date: expireDateStr
  });
  
  if (!createResult.success) {
    throw new Error(`Erro ao criar cliente no IBO: ${createResult.error}`);
  }
  
  console.log(`[Workflow] Cliente criado com sucesso no IBO!`);
  
  return {
    uniplay_test: {
      username: trialResult.username,
      password: trialResult.password,
      validUntil: trialResult.expiryFormatted || trialResult.expiry,
      m3uUrl: playlistUrl,
      shortUrl: trialResult.m3u8Short
    },
    ibo_client: {
      name: name,
      mac_address: mac_address,
      playlist: playlistUrl,
      expire_date: expireDateStr
    },
    message: `Cliente "${name}" criado com sucesso! Playlist do Uniplay vinculada.`
  };
}


export default router;