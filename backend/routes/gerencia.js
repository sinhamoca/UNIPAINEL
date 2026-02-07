// routes/gerencia.js
// Rotas para o GerenciaApp (IBO Revenda)

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as db from '../config/database.js';
import { getGerenciaClient, clearGerenciaClient } from '../services/gerencia-client.js';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// ==================== CONTAS ====================

// GET /api/gerencia/accounts - Listar contas
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.getGerenciaAccounts(req.user.id);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar contas' });
  }
});

// POST /api/gerencia/accounts - Criar conta
router.post('/accounts', (req, res) => {
  try {
    const { name, email, password, baseUrl } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e senha são obrigatórios'
      });
    }
    
    const accountId = db.createGerenciaAccount(req.user.id, {
      name,
      email,
      password,
      baseUrl: baseUrl || 'https://www.gerenciaapp.top'
    });
    
    res.status(201).json({
      success: true,
      accountId,
      message: 'Conta criada com sucesso'
    });
    
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar conta' });
  }
});

// GET /api/gerencia/accounts/:id - Obter conta específica
router.get('/accounts/:id', (req, res) => {
  try {
    const account = db.getGerenciaAccountById(parseInt(req.params.id), req.user.id);
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Não retornar senha
    delete account.password;
    delete account.session_cookies;
    
    res.json({ success: true, account });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter conta' });
  }
});

// PUT /api/gerencia/accounts/:id - Atualizar conta
router.put('/accounts/:id', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const { name, email, password, baseUrl, isActive } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;
    if (baseUrl !== undefined) updateData.base_url = baseUrl;
    if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;
    
    const updated = db.updateGerenciaAccount(accountId, req.user.id, updateData);
    
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Limpar cliente em memória se credenciais mudaram
    if (password || email) {
      clearGerenciaClient(accountId);
    }
    
    res.json({ success: true, message: 'Conta atualizada' });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar conta' });
  }
});

// DELETE /api/gerencia/accounts/:id - Deletar conta
router.delete('/accounts/:id', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const deleted = db.deleteGerenciaAccount(accountId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Limpar cliente em memória
    clearGerenciaClient(accountId);
    
    res.json({ success: true, message: 'Conta deletada' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Erro ao deletar conta' });
  }
});

// ==================== SESSÃO ====================

// POST /api/gerencia/accounts/:id/connect - Conectar/testar sessão
router.post('/accounts/:id/connect', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Verificar se conta pertence ao usuário
    const account = db.getGerenciaAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Inicializar cliente
    const client = getGerenciaClient(accountId);
    const result = await client.init();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.cached ? 'Sessão restaurada' : 'Conectado com sucesso',
        cached: result.cached || false
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Falha ao conectar'
      });
    }
    
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gerencia/accounts/:id/disconnect - Desconectar/limpar sessão
router.post('/accounts/:id/disconnect', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Verificar se conta pertence ao usuário
    const account = db.getGerenciaAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Limpar sessão
    db.clearGerenciaSession(accountId);
    clearGerenciaClient(accountId);
    
    res.json({ success: true, message: 'Sessão encerrada' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Erro ao desconectar' });
  }
});

// GET /api/gerencia/accounts/:id/status - Status da sessão
router.get('/accounts/:id/status', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const account = db.getGerenciaAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    const isConnected = account.session_valid_until && 
                        new Date(account.session_valid_until) > new Date();
    
    res.json({
      success: true,
      status: {
        connected: isConnected,
        lastLogin: account.last_login_at,
        sessionValidUntil: account.session_valid_until
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter status' });
  }
});

// ==================== USUÁRIOS ====================

// Middleware para verificar acesso à conta
async function withClient(req, res, next) {
  try {
    const accountId = parseInt(req.params.id);
    
    // Verificar se conta pertence ao usuário
    const account = db.getGerenciaAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Obter cliente
    const client = getGerenciaClient(accountId);
    await client.ensureLoggedIn();
    
    req.gerenciaClient = client;
    req.gerenciaAccount = account;
    next();
    
  } catch (error) {
    console.error('Client error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/gerencia/accounts/:id/users - Buscar usuários
router.get('/accounts/:id/users', withClient, async (req, res) => {
  try {
    const { search, page = 1, totalUsers } = req.query;
    const pageNum = parseInt(page) || 1;
    const perPage = 50; // GerenciaApp usa 50 por página
    const client = req.gerenciaClient;
    
    console.log(`[Gerencia] Buscando usuários - página ${pageNum}, search: ${search || 'nenhum'}`);
    
    let result;
    if (search) {
      result = await client.searchUsers(search, pageNum);
    } else {
      result = await client.getUsers(pageNum);
    }
    
    if (result?.props?.users) {
      const usersData = result.props.users;
      
      // GerenciaApp retorna array direto com 50 usuários por página
      let users = Array.isArray(usersData) ? usersData : (usersData.data || []);
      
      // Calcular paginação baseado no total de usuários (vem do frontend via stats)
      const total = parseInt(totalUsers) || 0;
      const lastPage = total > 0 ? Math.ceil(total / perPage) : (users.length === perPage ? pageNum + 1 : pageNum);
      
      const pagination = {
        currentPage: pageNum,
        lastPage: lastPage,
        total: total || (users.length + (pageNum - 1) * perPage),
        perPage: perPage
      };
      
      console.log(`[Gerencia] Página ${pageNum}/${lastPage}, ${users.length} usuários nesta página, total estimado: ${pagination.total}`);
      
      // Atualizar cache
      for (const user of users) {
        db.upsertGerenciaUserCache(parseInt(req.params.id), user);
      }
      
      res.json({
        success: true,
        users: users,
        pagination
      });
    } else {
      res.json({
        success: true,
        users: [],
        pagination: null
      });
    }
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gerencia/accounts/:id/users/search - Busca rápida (cache + API) - CORRIGIDO
router.get('/accounts/:id/users/search', withClient, async (req, res) => {
  try {
    const { q } = req.query;
    const accountId = parseInt(req.params.id);
    
    console.log(`[SEARCH] Query: "${q}", Account: ${accountId}`);
    
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }
    
    // Primeiro buscar no cache
    let cacheResults = db.searchGerenciaUsersCache(accountId, q, 10);
    
    // Verificar se cache tem dados válidos
    const cacheValid = cacheResults.length > 0 && cacheResults.some(u => u.server_name);
    
    let users = [];
    let source = 'none';
    
    if (cacheValid) {
      // Usar cache
      source = 'cache';
      users = cacheResults.map(u => ({
        id: u.remote_id,
        server_name: u.server_name || 'Sem nome',  // ← CORRIGIDO: usar server_name
        mac_device: u.mac_device || 'N/A',         // ← CORRIGIDO: usar mac_device
        expire_date: u.expire_date || null,        // ← CORRIGIDO: usar expire_date
        expire_account: u.expire_date || null,
        data: u.raw_data ? JSON.parse(u.raw_data) : null
      }));
    } else {
      // Buscar na API
      console.log(`[SEARCH] Cache vazio/inválido, buscando na API...`);
      
      const result = await req.gerenciaClient.searchUsers(q, 1);
      
      if (result?.props?.users) {
        const apiUsers = result.props.users.data || result.props.users;
        
        if (Array.isArray(apiUsers) && apiUsers.length > 0) {
          source = 'api';
          users = apiUsers.map(u => ({
            id: u.id,
            server_name: u.server_name || 'Sem nome',  // ← CORRIGIDO
            mac_device: u.mac_device || 'N/A',         // ← CORRIGIDO
            expire_date: u.expire_date || u.expire_account || null,  // ← CORRIGIDO
            expire_account: u.expire_account || u.expire_date || null,
            data: u
          }));
          
          // Salvar no cache
          for (const user of apiUsers) {
            if (user.id) {
              db.upsertGerenciaUserCache(accountId, user);
            }
          }
        }
      }
    }
    
    console.log(`[SEARCH] Retornando ${users.length} usuários (source: ${source})`);
    
    res.json({
      success: true,
      source,
      users
    });
    
  } catch (error) {
    console.error('[SEARCH] ERRO:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gerencia/accounts/:id/users - Criar usuário
router.post('/accounts/:id/users', withClient, async (req, res) => {
  try {
    const { serverName, macDevice, m3u8List, expireDays, dns, whatsapp } = req.body;
    
    if (!serverName) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    // Calcular data de expiração
    let expireDate = null;
    if (expireDays) {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(expireDays));
      expireDate = date.toISOString().split('T')[0];
    }
    
    const result = await req.gerenciaClient.createUser({
      server_name: serverName,
      mac_device: macDevice || '00:00:00:00:00:00',
      m3u8_list: m3u8List || '',
      expire_date: expireDate,
      dns: dns || '',
      whatsapp: whatsapp || ''
    });
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        user: result.user
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Erro ao criar usuário',
        errors: result.errors
      });
    }
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/gerencia/accounts/:id/users/:userId - Editar usuário
router.put('/accounts/:id/users/:userId', withClient, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Aceitar tanto camelCase quanto snake_case do frontend
    const serverName = req.body.serverName ?? req.body.server_name;
    const macDevice = req.body.macDevice ?? req.body.mac_device;
    const m3u8List = req.body.m3u8List ?? req.body.m3u8_list;
    const expireDate = req.body.expireDate ?? req.body.expire_date;
    const dns = req.body.dns;
    
    console.log('[DEBUG PUT] userId:', userId);
    console.log('[DEBUG PUT] Dados extraídos:', { serverName, macDevice, m3u8List, expireDate, dns });
    
    const updateData = {};
    if (serverName !== undefined) updateData.server_name = serverName;
    if (macDevice !== undefined) updateData.mac_device = macDevice;
    if (m3u8List !== undefined) updateData.m3u8_list = m3u8List;
    if (expireDate !== undefined) updateData.expire_date = expireDate;
    if (dns !== undefined) updateData.dns = dns;
    
    console.log('[DEBUG PUT] updateData:', updateData);
    
    // Buscar usuário atual
    const user = await req.gerenciaClient.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    
    console.log('[DEBUG PUT] Usuário atual:', user.server_name);
    
    // Montar payload completo
    const payload = {
      modo_selecao: user.modo_selecao || 1,
      mac_device: updateData.mac_device ?? user.mac_device,
      server_name: updateData.server_name ?? user.server_name,
      account_username: user.email || '',
      account_password: '',
      xteam_username: user.xteam_username || null,
      xteam_password: user.xteam_password || null,
      dns: updateData.dns ?? user.dns,
      m3u8_list: updateData.m3u8_list ?? user.m3u8_list,
      url_epg: user.url_epg || null,
      price: user.price || null,
      ranking_app_id: undefined,
      plan_id: user.plan_id || null,
      expire_date: updateData.expire_date ?? user.expire_account ?? user.expire_date
    };
    
    console.log('[DEBUG PUT] Payload final - server_name:', payload.server_name);
    
    const result = await req.gerenciaClient.updateUser(userId, payload);
    
    console.log('[DEBUG PUT] Resultado:', result);
    
    if (result.success) {
      // Atualizar cache
      const updatedUser = { ...user, ...payload };
      db.upsertGerenciaUserCache(parseInt(req.params.id), updatedUser);
      
      db.logGerenciaAction(
        parseInt(req.params.id), 
        'edit_user', 
        userId, 
        user.server_name, 
        `Campos alterados: ${Object.keys(updateData).join(', ')}`
      );
      
      res.json({
        success: true,
        message: 'Usuário atualizado'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Erro ao atualizar usuário'
      });
    }
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gerencia/accounts/:id/users/:userId/renew - Renovar usuário
router.post('/accounts/:id/users/:userId/renew', withClient, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { days } = req.body;
    
    if (!days || days < 1) {
      return res.status(400).json({ success: false, error: 'Dias deve ser maior que 0' });
    }
    
    const result = await req.gerenciaClient.renewUser(userId, parseInt(days));
    
    if (result.success) {
      res.json({
        success: true,
        message: `Usuário renovado por ${days} dias`,
        newExpireDate: result.user.newExpireDate
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Erro ao renovar usuário'
      });
    }
    
  } catch (error) {
    console.error('Renew user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/gerencia/accounts/:id/users/:userId - Deletar usuário
router.delete('/accounts/:id/users/:userId', withClient, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Buscar usuário para log
    const user = await req.gerenciaClient.getUserById(userId);
    
    const result = await req.gerenciaClient.deleteUserById(userId);
    
    if (result.success) {
      if (user) {
        db.logGerenciaAction(
          parseInt(req.params.id), 
          'delete_user', 
          userId, 
          user.server_name, 
          `MAC: ${user.mac_device}`
        );
      }
      
      res.json({
        success: true,
        message: 'Usuário deletado'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Erro ao deletar usuário'
      });
    }
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DASHBOARD/STATS ====================

// GET /api/gerencia/accounts/:id/dashboard - Dashboard da conta
router.get('/accounts/:id/dashboard', withClient, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Buscar dashboard do painel para pegar userCount real
    const panelDashboard = await req.gerenciaClient.getDashboard();
    
    // Debug: mostrar resposta completa
    console.log(`[Gerencia] Dashboard response type:`, typeof panelDashboard);
    console.log(`[Gerencia] Dashboard keys:`, panelDashboard ? Object.keys(panelDashboard) : 'null');
    if (panelDashboard?.props) {
      console.log(`[Gerencia] Dashboard props keys:`, Object.keys(panelDashboard.props));
      console.log(`[Gerencia] Dashboard props.userCount:`, panelDashboard.props.userCount);
    }
    if (panelDashboard?.error) {
      console.log(`[Gerencia] Dashboard error:`, panelDashboard.error);
    }
    
    // Extrair userCount do dashboard do painel
    const userCount = panelDashboard?.props?.userCount || 0;
    
    console.log(`[Gerencia] Dashboard - userCount do painel: ${userCount}`);
    
    res.json({
      success: true,
      stats: {
        total: userCount,
        // Esses dados poderiam vir do painel também se necessário
        active: 0,
        expiringSoon: 0,
        expired: 0
      },
      panelDashboard: panelDashboard?.props || null
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gerencia/accounts/:id/sync - Sincronizar cache
router.post('/accounts/:id/sync', withClient, async (req, res) => {
  try {
    const { pages = 5 } = req.body;
    
    const result = await req.gerenciaClient.syncCache(parseInt(pages));
    
    res.json({
      success: true,
      message: `Cache sincronizado: ${result.totalUsers} usuários`,
      totalUsers: result.totalUsers
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOGS ====================

// GET /api/gerencia/accounts/:id/logs - Logs da conta
router.get('/accounts/:id/logs', (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const { limit = 50 } = req.query;
    
    // Verificar se conta pertence ao usuário
    const account = db.getGerenciaAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    const logs = db.getGerenciaLogs(accountId, parseInt(limit));
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ success: false, error: 'Erro ao obter logs' });
  }
});

export default router;