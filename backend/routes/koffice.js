// routes/koffice.js
// Rotas para o painel Koffice

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as db from '../config/database.js';
import { getKofficeClient, clearKofficeClient, getKeeperStatus } from '../services/koffice/index.js';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// ==================== CONTAS ====================

// GET /api/koffice/accounts - Listar contas
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.getKofficeAccounts(req.user.id);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Get koffice accounts error:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar contas' });
  }
});

// POST /api/koffice/accounts - Criar conta
router.post('/accounts', (req, res) => {
  try {
    const { name, domain, username, password, hasCaptcha } = req.body;

    if (!name || !domain || !username || !password) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: name, domain, username, password' });
    }

    // Normalizar domínio
    let normalizedDomain = domain.trim();
    if (!normalizedDomain.startsWith('http')) {
      normalizedDomain = 'https://' + normalizedDomain;
    }
    normalizedDomain = normalizedDomain.replace(/\/$/, '');

    const accountId = db.createKofficeAccount(req.user.id, {
      name: name.trim(),
      domain: normalizedDomain,
      username: username.trim(),
      password,
      hasCaptcha: !!hasCaptcha
    });

    const account = db.getKofficeAccountById(accountId, req.user.id);
    res.json({ success: true, account });
  } catch (error) {
    console.error('Create koffice account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/koffice/accounts/:id - Atualizar conta
router.put('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, username, password, hasCaptcha, isActive } = req.body;

    // Verificar se conta pertence ao usuário
    const account = db.getKofficeAccountById(id, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    // Normalizar domínio
    let normalizedDomain = domain ? domain.trim() : account.domain;
    if (normalizedDomain && !normalizedDomain.startsWith('http')) {
      normalizedDomain = 'https://' + normalizedDomain;
    }
    normalizedDomain = normalizedDomain.replace(/\/$/, '');

    const updateData = {
      name: name || account.name,
      domain: normalizedDomain,
      username: username || account.username,
      has_captcha: hasCaptcha !== undefined ? (hasCaptcha ? 1 : 0) : account.has_captcha,
      is_active: isActive !== undefined ? (isActive ? 1 : 0) : account.is_active,
    };

    if (password) {
      updateData.password = password;
    }

    db.updateKofficeAccount(id, req.user.id, updateData);

    // Limpar instância do client
    clearKofficeClient(id);

    const updatedAccount = db.getKofficeAccountById(id, req.user.id);
    res.json({ success: true, account: updatedAccount });
  } catch (error) {
    console.error('Update koffice account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/koffice/accounts/:id - Deletar conta
router.delete('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountById(id, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    db.deleteKofficeAccount(id, req.user.id);
    clearKofficeClient(id);

    res.json({ success: true, message: 'Conta removida' });
  } catch (error) {
    console.error('Delete koffice account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CONEXÃO ====================

// POST /api/koffice/accounts/:id/connect - Conectar (fazer login)
router.post('/accounts/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    clearKofficeClient(id);
    const client = getKofficeClient(account);

    await client.login();

    // Recarregar conta com dados atualizados
    const updatedAccount = db.getKofficeAccountById(id, req.user.id);

    res.json({ 
      success: true, 
      message: 'Conectado com sucesso',
      account: updatedAccount
    });
  } catch (error) {
    console.error('Connect koffice account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/accounts/:id/status - Verificar status da conexão
router.get('/accounts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const isActive = await client.checkSession();

    res.json({ 
      success: true, 
      connected: isActive,
      sessionValidUntil: account.session_valid_until,
      loginCount: account.login_count
    });
  } catch (error) {
    console.error('Check koffice status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/keeper/status - Status do Session Keeper
router.get('/keeper/status', (req, res) => {
  try {
    const status = getKeeperStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Get keeper status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CLIENTES ====================

// GET /api/koffice/accounts/:id/clients - Listar clientes
router.get('/accounts/:id/clients', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 20 } = req.query;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.getClients(parseInt(page), parseInt(perPage));

    res.json(result);
  } catch (error) {
    console.error('List koffice clients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/accounts/:id/clients/search - Buscar clientes
router.get('/accounts/:id/clients/search', async (req, res) => {
  try {
    const { id } = req.params;
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.searchClients(q, parseInt(limit));

    res.json(result);
  } catch (error) {
    console.error('Search koffice clients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/clients/:clientId/renew - Renovar cliente
router.post('/accounts/:id/clients/:clientId/renew', async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const { months } = req.body;

    if (!months || months < 1 || months > 12) {
      return res.status(400).json({ success: false, error: 'Meses deve ser entre 1 e 12' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.renewClient(clientId, parseInt(months));

    if (result.success) {
      db.logKofficeAction(id, 'renew', clientId, null, `+${months} mês(es)`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Renew koffice client error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/clients/:clientId/reset-username - Resetar username
router.post('/accounts/:id/clients/:clientId/reset-username', async (req, res) => {
  try {
    const { id, clientId } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.resetClientAttribute(clientId, 'username');

    if (result.success) {
      db.logKofficeAction(id, 'reset_username', clientId, null, `Novo: ${result.newValue}`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Reset koffice username error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/clients/:clientId/reset-password - Resetar password
router.post('/accounts/:id/clients/:clientId/reset-password', async (req, res) => {
  try {
    const { id, clientId } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.resetClientAttribute(clientId, 'password');

    if (result.success) {
      db.logKofficeAction(id, 'reset_password', clientId, null, `Novo: ${result.newValue}`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Reset koffice password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/koffice/accounts/:id/clients/:clientId/notes - Editar nome/notas
router.put('/accounts/:id/clients/:clientId/notes', async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ success: false, error: 'Notas não podem estar vazias' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.editClientNotes(clientId, notes);

    if (result.success) {
      db.logKofficeAction(id, 'edit_notes', clientId, null, notes, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Edit koffice client notes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/accounts/:id/clients/:clientId/data - Obter dados do cliente (fast_message)
router.get('/accounts/:id/clients/:clientId/data', async (req, res) => {
  try {
    const { id, clientId } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.getClientFastMessage(clientId);

    if (result.success) {
      db.logKofficeAction(id, 'get_data', clientId, null, `User: ${result.user}`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Get koffice client data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TESTE ====================

// POST /api/koffice/accounts/:id/test - Criar teste rápido
router.post('/accounts/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.createFastTest();

    if (result.success) {
      db.logKofficeAction(id, 'create_test', null, null, `User: ${result.user}`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Create koffice test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DASHBOARD / STATS ====================

router.get('/accounts/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountById(id, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    // Buscar últimos logs
    const logs = db.getKofficeLogs(id, 10);
    const stats = db.getKofficeStats(id);

    res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        domain: account.domain,
        connected: account.session_valid_until && new Date(account.session_valid_until) > new Date(),
        loginCount: account.login_count,
        lastLogin: account.last_login_at
      },
      stats,
      recentLogs: logs
    });
  } catch (error) {
    console.error('Get koffice dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REVENDAS ====================

// GET /api/koffice/accounts/:id/resellers - Listar revendas
router.get('/accounts/:id/resellers', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 20 } = req.query;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.getResellers(parseInt(page), parseInt(perPage));

    res.json(result);
  } catch (error) {
    console.error('List koffice resellers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/accounts/:id/resellers/search - Buscar revendas
router.get('/accounts/:id/resellers/search', async (req, res) => {
  try {
    const { id } = req.params;
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.searchResellers(q, parseInt(limit));

    res.json(result);
  } catch (error) {
    console.error('Search koffice resellers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/koffice/accounts/:id/resellers/:resellerId - Detalhes da revenda
router.get('/accounts/:id/resellers/:resellerId', async (req, res) => {
  try {
    const { id, resellerId } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.getResellerDetails(resellerId);

    res.json(result);
  } catch (error) {
    console.error('Get koffice reseller details error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/resellers - Criar revenda
router.post('/accounts/:id/resellers', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, name, credits, expiry } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username e senha são obrigatórios' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.createReseller({ username, password, name, credits, expiry });

    if (result.success) {
      db.logKofficeAction(id, 'create_reseller', null, username, `Créditos: ${credits || 0}`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Create koffice reseller error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/resellers/:resellerId/renew - Renovar revenda
router.post('/accounts/:id/resellers/:resellerId/renew', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { months } = req.body;

    if (!months || months < 1 || months > 12) {
      return res.status(400).json({ success: false, error: 'Meses deve ser entre 1 e 12' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.renewReseller(resellerId, parseInt(months));

    if (result.success) {
      db.logKofficeAction(id, 'renew_reseller', resellerId, null, `+${months} mês(es)`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Renew koffice reseller error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRÉDITOS ====================

// GET /api/koffice/accounts/:id/credits - Ver saldo de créditos
router.get('/accounts/:id/credits', async (req, res) => {
  try {
    const { id } = req.params;

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.getCredits();

    res.json(result);
  } catch (error) {
    console.error('Get koffice credits error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/resellers/:resellerId/credits/add - Adicionar créditos
router.post('/accounts/:id/resellers/:resellerId/credits/add', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;

    if (!credits || credits < 1) {
      return res.status(400).json({ success: false, error: 'Quantidade de créditos inválida' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.addCreditsToReseller(resellerId, parseInt(credits));

    if (result.success) {
      db.logKofficeAction(id, 'add_credits', resellerId, null, `+${credits} créditos`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Add koffice credits error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/koffice/accounts/:id/resellers/:resellerId/credits/remove - Remover créditos
router.post('/accounts/:id/resellers/:resellerId/credits/remove', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;

    if (!credits || credits < 1) {
      return res.status(400).json({ success: false, error: 'Quantidade de créditos inválida' });
    }

    const account = db.getKofficeAccountFull(id);
    if (!account || account.user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }

    const client = getKofficeClient(account);
    const result = await client.removeCreditsFromReseller(resellerId, parseInt(credits));

    if (result.success) {
      db.logKofficeAction(id, 'remove_credits', resellerId, null, `-${credits} créditos`, true);
    }

    res.json(result);
  } catch (error) {
    console.error('Remove koffice credits error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
