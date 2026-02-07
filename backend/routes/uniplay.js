// ========================================
// UNIPLAY ROUTES - API Endpoints
// ========================================

import express from 'express';
import { run, get, all } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import uniplayService from '../services/uniplay/index.js';

const router = express.Router();

// Todos os endpoints precisam de autenticação
router.use(authenticateToken);

// ========================================
// CONTAS UNIPLAY
// ========================================

// GET /api/uniplay/accounts - Listar contas do usuário
router.get('/accounts', function(req, res) {
  try {
    var accounts = all(
      'SELECT id, name, username, created_at, last_login_at FROM uniplay_accounts WHERE user_id = ? AND is_active = 1 ORDER BY name',
      [req.user.id]
    );
    
    // Adicionar status do cache para cada conta
    var cacheStatus = uniplayService.getCacheStatus();
    
    accounts = accounts.map(function(acc) {
      var cached = cacheStatus.tokens.find(function(t) { return t.accountId === acc.id; });
      acc.hasActiveToken = cached ? cached.valid : false;
      acc.tokenExpiresIn = cached ? cached.expiresIn : null;
      return acc;
    });
    
    res.json({ success: true, accounts: accounts });
  } catch (error) {
    console.error('Erro ao listar contas Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/uniplay/accounts - Criar nova conta
router.post('/accounts', async function(req, res) {
  try {
    var { name, username, password } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, error: 'Nome, usuário e senha são obrigatórios' });
    }
    
    // Verificar se já existe
    var existing = get(
      'SELECT id FROM uniplay_accounts WHERE user_id = ? AND username = ? AND is_active = 1',
      [req.user.id, username]
    );
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Já existe uma conta com este usuário' });
    }
    
    // Testar conexão antes de salvar
    console.log('[Uniplay] Testando conexão para nova conta...');
    var testResult = await uniplayService.testConnection(username, password);
    
    if (!testResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Falha ao conectar: ' + testResult.error 
      });
    }
    
    // Salvar no banco
    var result = run(
      'INSERT INTO uniplay_accounts (user_id, name, username, password, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [req.user.id, name, username, password]
    );
    
    console.log('[Uniplay] Conta criada: ' + name + ' (ID: ' + result.lastInsertRowid + ')');
    
    res.json({ 
      success: true, 
      accountId: result.lastInsertRowid,
      message: 'Conta criada e conexão testada com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao criar conta Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/uniplay/accounts/:id - Atualizar conta
router.put('/accounts/:id', async function(req, res) {
  try {
    var { id } = req.params;
    var { name, username, password } = req.body;
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Se mudou credenciais, testar conexão
    if ((username && username !== account.username) || password) {
      var testUsername = username || account.username;
      var testPassword = password || account.password;
      
      console.log('[Uniplay] Testando novas credenciais...');
      var testResult = await uniplayService.testConnection(testUsername, testPassword);
      
      if (!testResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: 'Novas credenciais inválidas: ' + testResult.error 
        });
      }
      
      // Limpar cache do token antigo
      uniplayService.clearCachedToken(parseInt(id));
    }
    
    // Atualizar
    run(
      'UPDATE uniplay_accounts SET name = ?, username = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [
        name || account.name,
        username || account.username,
        password || account.password,
        id,
        req.user.id
      ]
    );
    
    res.json({ success: true, message: 'Conta atualizada!' });
  } catch (error) {
    console.error('Erro ao atualizar conta Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/uniplay/accounts/:id - Deletar conta
router.delete('/accounts/:id', function(req, res) {
  try {
    var { id } = req.params;
    
    var account = get(
      'SELECT name FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Soft delete
    run(
      'UPDATE uniplay_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    // Limpar cache
    uniplayService.clearCachedToken(parseInt(id));
    
    console.log('[Uniplay] Conta deletada: ' + account.name);
    
    res.json({ success: true, message: 'Conta removida!' });
  } catch (error) {
    console.error('Erro ao deletar conta Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CLIENTES
// ========================================

// GET /api/uniplay/accounts/:id/clients - Listar clientes
router.get('/accounts/:id/clients', async function(req, res) {
  try {
    var { id } = req.params;
    var { type } = req.query; // 'p2p', 'iptv', ou 'all'
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    console.log('[Uniplay] Buscando clientes para conta: ' + account.name);
    
    var result;
    
    if (type === 'p2p') {
      var p2p = await uniplayService.getP2PClients(account);
      result = { p2p: p2p, iptv: [], total: p2p.length };
    } else if (type === 'iptv') {
      var iptv = await uniplayService.getIPTVClients(account);
      result = { p2p: [], iptv: iptv, total: iptv.length };
    } else {
      result = await uniplayService.getAllClients(account);
    }
    
    res.json({ 
      success: true, 
      account: { id: account.id, name: account.name },
      clients: result
    });
  } catch (error) {
    console.error('Erro ao listar clientes Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/uniplay/accounts/:id/clients/search - Buscar cliente por nome
router.get('/accounts/:id/clients/search', async function(req, res) {
  try {
    var { id } = req.params;
    var { name, type } = req.query;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    var searchType = type || 'auto';
    var result = await uniplayService.findClientByName(account, name, searchType);
    
    res.json({ 
      success: true, 
      found: result.found,
      client: result.client,
      similar: result.similar
    });
  } catch (error) {
    console.error('Erro ao buscar cliente Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/uniplay/accounts/:id/clients/:clientId/links - Obter links M3U do cliente
router.get('/accounts/:id/clients/:clientId/links', async function(req, res) {
  try {
    var { id, clientId } = req.params;
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    console.log('[Uniplay] Buscando links do cliente: ' + clientId);
    
    var result = await uniplayService.getClientLinks(account, clientId);
    
    res.json({ 
      success: true, 
      links: result
    });
  } catch (error) {
    console.error('Erro ao buscar links Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// RENOVAÇÃO
// ========================================

// POST /api/uniplay/accounts/:id/clients/:clientId/renew - Renovar cliente
router.post('/accounts/:id/clients/:clientId/renew', async function(req, res) {
  try {
    var { id, clientId } = req.params;
    var { type, credits } = req.body;
    
    if (!type || !['p2p', 'iptv'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo deve ser "p2p" ou "iptv"' });
    }
    
    var creditsNum = parseInt(credits) || 1;
    if (creditsNum < 1) {
      return res.status(400).json({ success: false, error: 'Créditos deve ser >= 1' });
    }
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    console.log('[Uniplay] Renovando cliente ' + clientId + ' com ' + creditsNum + ' crédito(s)');
    
    var result = await uniplayService.renewClient(account, clientId, type, creditsNum);
    
    res.json({ 
      success: true, 
      message: 'Cliente renovado com sucesso!',
      result: result
    });
  } catch (error) {
    console.error('Erro ao renovar cliente Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CRIAR TESTE RÁPIDO
// ========================================

// POST /api/uniplay/accounts/:id/trial - Criar teste rápido
router.post('/accounts/:id/trial', async function(req, res) {
  try {
    var { id } = req.params;
    var { hours, nota, packageId } = req.body;
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    console.log('[Uniplay] Criando teste para conta: ' + account.name);
    
    var result = await uniplayService.createTrial(account, {
      hours: hours || 3,
      nota: nota || 'Teste criado via UniPanel',
      packageId: packageId || '1'
    });
    
    res.json({ 
      success: true, 
      trial: result
    });
  } catch (error) {
    console.error('Erro ao criar teste Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// STATUS / UTILIDADES
// ========================================

// GET /api/uniplay/status - Status do módulo
router.get('/status', function(req, res) {
  try {
    var cacheStatus = uniplayService.getCacheStatus();
    var proxyConfig = uniplayService.checkProxyConfig();
    
    var accountCount = get(
      'SELECT COUNT(*) as count FROM uniplay_accounts WHERE user_id = ? AND is_active = 1',
      [req.user.id]
    );
    
    res.json({
      success: true,
      accounts: accountCount.count,
      tokenCache: cacheStatus,
      proxy: proxyConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/uniplay/proxy-status - Status do proxy
router.get('/proxy-status', function(req, res) {
  try {
    var proxyConfig = uniplayService.checkProxyConfig();
    res.json({ success: true, proxy: proxyConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/uniplay/accounts/:id/test - Testar conexão
router.post('/accounts/:id/test', async function(req, res) {
  try {
    var { id } = req.params;
    
    var account = get(
      'SELECT * FROM uniplay_accounts WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Limpar cache para forçar novo login
    uniplayService.clearCachedToken(parseInt(id));
    
    var result = await uniplayService.testConnection(account.username, account.password);
    
    res.json({ 
      success: result.success, 
      message: result.success ? 'Conexão OK!' : result.error,
      userId: result.userId
    });
  } catch (error) {
    console.error('Erro ao testar conexão Uniplay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;