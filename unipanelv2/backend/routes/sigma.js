// routes/sigma.js
// Rotas para integração com painéis Sigma
// ATUALIZADO: Usa módulos sigma/ com re-login automático

import { Router } from 'express';
import { run, get, all } from '../config/database.js';
import { getSigmaClient, clearSigmaClient, getAuthenticatedClient, getSigmaKeeperStatus, sigmaKeeper } from '../services/sigma/index.js';

const router = Router();

// ==================== CONTAS ====================

// Listar contas Sigma
router.get('/accounts', async (req, res) => {
  try {
    const accounts = all(`
      SELECT id, name, domain, username, auth_token, session_valid_until, created_at
      FROM sigma_accounts
      ORDER BY created_at DESC
    `);
    
    // Verificar status de conexão
    const now = new Date();
    const accountsWithStatus = accounts.map(acc => ({
      ...acc,
      is_connected: acc.session_valid_until && new Date(acc.session_valid_until) > now
    }));
    
    res.json({ success: true, accounts: accountsWithStatus });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar contas:', error);
    res.status(500).json({ success: false, error: 'Erro ao listar contas' });
  }
});

// Criar conta Sigma
router.post('/accounts', async (req, res) => {
  try {
    const { name, domain, username, password } = req.body;
    
    if (!name || !domain || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome, domínio, usuário e senha são obrigatórios' 
      });
    }
    
    // Validar formato do domínio
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domínio deve começar com http:// ou https://' 
      });
    }
    
    // Verificar duplicidade
    const existing = get(
      'SELECT id FROM sigma_accounts WHERE domain = ? AND username = ?',
      [domain.replace(/\/$/, ''), username]
    );
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: 'Conta já cadastrada para este domínio e usuário' 
      });
    }
    
    // Inserir conta
    run(`
      INSERT INTO sigma_accounts (name, domain, username, password, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [name, domain.replace(/\/$/, ''), username, password]);
    
    const result = get('SELECT last_insert_rowid() as id');
    
    console.log(`✅ [SIGMA] Conta criada: ${name} (${domain})`);
    
    res.json({ 
      success: true, 
      message: 'Conta criada com sucesso',
      account: {
        id: result?.id,
        name,
        domain: domain.replace(/\/$/, ''),
        username
      }
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao criar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar conta' });
  }
});

// Conectar conta (fazer login e salvar token)
router.post('/accounts/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar conta
    const account = get('SELECT * FROM sigma_accounts WHERE id = ?', [id]);
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    console.log(`🔌 [SIGMA] Conectando: ${account.name} (${account.domain})`);
    
    // Limpar cliente anterior
    clearSigmaClient(id);
    
    // Obter cliente e fazer login
    const client = getSigmaClient(account);
    const loginResult = await client.login();
    
    // Adicionar ao keeper
    sigmaKeeper.addSession(account);
    
    console.log(`✅ [SIGMA] Conectado com sucesso: ${account.name}`);
    
    // Buscar conta atualizada
    const updatedAccount = get('SELECT session_valid_until FROM sigma_accounts WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: 'Conectado com sucesso',
      session_valid_until: updatedAccount?.session_valid_until
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao conectar:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao conectar' 
    });
  }
});

// Atualizar conta
router.put('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, username, password } = req.body;
    
    // Verificar se existe
    const existing = get('SELECT id FROM sigma_accounts WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada' });
    }
    
    // Limpar cliente do cache
    clearSigmaClient(id);
    
    // Atualizar (password é opcional)
    if (password) {
      run(`
        UPDATE sigma_accounts 
        SET name = ?, domain = ?, username = ?, password = ?, auth_token = NULL, session_valid_until = NULL
        WHERE id = ?
      `, [name, domain.replace(/\/$/, ''), username, password, id]);
    } else {
      run(`
        UPDATE sigma_accounts 
        SET name = ?, domain = ?, username = ?
        WHERE id = ?
      `, [name, domain.replace(/\/$/, ''), username, id]);
    }
    
    res.json({ success: true, message: 'Conta atualizada' });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao atualizar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar conta' });
  }
});

// Deletar conta
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    clearSigmaClient(id);
    run('DELETE FROM sigma_accounts WHERE id = ?', [id]);
    
    console.log(`🗑️ [SIGMA] Conta deletada: ${id}`);
    
    res.json({ success: true, message: 'Conta removida' });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao deletar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao deletar conta' });
  }
});

// ==================== KEEPER STATUS ====================

router.get('/keeper/status', async (req, res) => {
  try {
    const status = getSigmaKeeperStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao obter status do keeper:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CLIENTES ====================

// Listar clientes de uma conta
router.get('/accounts/:id/customers', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 50, search = '' } = req.query;
    
    const { client, account } = await getAuthenticatedClient(id);
    
    const result = await client.getCustomers(
      parseInt(page), 
      parseInt(perPage), 
      search
    );
    
    res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        domain: account.domain
      },
      customers: result.customers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar clientes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao listar clientes' 
    });
  }
});

// Buscar cliente específico
router.get('/accounts/:id/customers/:customerId', async (req, res) => {
  try {
    const { id, customerId } = req.params;
    
    const { client } = await getAuthenticatedClient(id);
    
    const customer = await client.getCustomerDetails(customerId);
    
    res.json({ success: true, customer });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao buscar cliente' 
    });
  }
});

// Buscar playlist do cliente
router.get('/accounts/:id/customers/:customerId/playlist', async (req, res) => {
  try {
    const { id, customerId } = req.params;
    
    const { client } = await getAuthenticatedClient(id);
    
    const playlist = await client.getCustomerPlaylist(customerId);
    
    res.json({ success: true, playlist });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar playlist:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao buscar playlist' 
    });
  }
});

// ==================== PACOTES ====================

// Buscar pacotes disponíveis
router.get('/accounts/:id/packages', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { client, account } = await getAuthenticatedClient(id);
    
    const { servers, packages } = await client.getServersAndPackages();
    
    res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        domain: account.domain
      },
      servers,
      packages
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar pacotes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao buscar pacotes' 
    });
  }
});

// Buscar apenas pacotes trial
router.get('/accounts/:id/packages/trial', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { client, account } = await getAuthenticatedClient(id);
    
    const packages = await client.getTrialPackages();
    
    res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        domain: account.domain
      },
      packages
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar pacotes trial:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao buscar pacotes trial' 
    });
  }
});

// ==================== RENOVAÇÃO ====================

// Renovar cliente
router.post('/accounts/:id/customers/:customerId/renew', async (req, res) => {
  try {
    const { id, customerId } = req.params;
    const { package_id, connections = 1 } = req.body;
    
    if (!package_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'package_id é obrigatório' 
      });
    }
    
    const { client, account } = await getAuthenticatedClient(id);
    
    console.log(`🔄 [SIGMA] Renovando cliente ${customerId} na conta ${account.name}`);
    
    const result = await client.renewCustomer(customerId, package_id, connections);
    
    res.json({
      success: true,
      message: 'Cliente renovado com sucesso',
      expires_at: result.expires_at,
      status: result.status,
      customer: result.customer
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao renovar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao renovar cliente' 
    });
  }
});

// ==================== CRIAR TESTE (TRIAL) ====================

router.post('/accounts/:id/customers/trial', async (req, res) => {
  try {
    const { id } = req.params;
    const { server_id, package_id, trial_hours = 24, connections = 1 } = req.body;
    
    if (!server_id || !package_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'server_id e package_id são obrigatórios' 
      });
    }
    
    const { client, account } = await getAuthenticatedClient(id);
    
    console.log(`🧪 [SIGMA] Criando teste na conta ${account.name}`);
    
    const result = await client.createTrialCustomer(server_id, package_id, trial_hours, connections);
    
    res.json({
      success: true,
      message: 'Teste criado com sucesso',
      customer: result.customer,
      playlist: result.playlist
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao criar teste:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao criar teste' 
    });
  }
});

// ==================== REVENDEDORES ====================

// Listar revendedores
router.get('/accounts/:id/resellers', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 20, search = '' } = req.query;
    
    const { client, account } = await getAuthenticatedClient(id);
    
    const result = await client.getResellers(
      parseInt(page), 
      parseInt(perPage), 
      search
    );
    
    res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        domain: account.domain
      },
      resellers: result.resellers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar revendedores:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao listar revendedores' 
    });
  }
});

// Adicionar créditos ao revendedor
router.post('/accounts/:id/resellers/:resellerId/add-credits', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;
    
    if (!credits || credits <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantidade de créditos inválida' 
      });
    }
    
    const { client, account } = await getAuthenticatedClient(id);
    
    console.log(`💰 [SIGMA] Adicionando ${credits} créditos ao revendedor ${resellerId}`);
    
    const result = await client.addCredits(resellerId, credits);
    
    res.json({
      success: true,
      message: `${credits} créditos adicionados com sucesso`,
      response: result.response
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao adicionar créditos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao adicionar créditos' 
    });
  }
});

// Remover créditos do revendedor
router.post('/accounts/:id/resellers/:resellerId/remove-credits', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;
    
    if (!credits || credits <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantidade de créditos inválida' 
      });
    }
    
    const { client, account } = await getAuthenticatedClient(id);
    
    console.log(`💸 [SIGMA] Removendo ${credits} créditos do revendedor ${resellerId}`);
    
    const result = await client.removeCredits(resellerId, credits);
    
    res.json({
      success: true,
      message: `${credits} créditos removidos com sucesso`,
      response: result.response
    });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao remover créditos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao remover créditos' 
    });
  }
});

export default router;
