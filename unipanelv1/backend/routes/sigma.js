// routes/sigma.js
// Rotas para integração com painéis Sigma

import { Router } from 'express';
import { run, get, all } from '../config/database.js';
import SigmaService from '../services/sigma.js';

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
    
    // Fazer login
    const service = new SigmaService(account.domain, account.username, account.password);
    const loginResult = await service.login();
    
    // Calcular validade da sessão (24 horas)
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);
    
    // Salvar token
    run(`
      UPDATE sigma_accounts 
      SET auth_token = ?, session_valid_until = ?
      WHERE id = ?
    `, [loginResult.token, validUntil.toISOString(), id]);
    
    console.log(`✅ [SIGMA] Conectado com sucesso: ${account.name}`);
    
    res.json({ 
      success: true, 
      message: 'Conectado com sucesso',
      session_valid_until: validUntil.toISOString()
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
    
    run('DELETE FROM sigma_accounts WHERE id = ?', [id]);
    
    console.log(`🗑️ [SIGMA] Conta deletada: ${id}`);
    
    res.json({ success: true, message: 'Conta removida' });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao deletar conta:', error);
    res.status(500).json({ success: false, error: 'Erro ao deletar conta' });
  }
});

// ==================== CLIENTES ====================

// Helper: obter service autenticado
async function getAuthenticatedService(accountId) {
  console.log(`🔐 [SIGMA] getAuthenticatedService para conta ${accountId}`);
  
  const account = get('SELECT * FROM sigma_accounts WHERE id = ?', [accountId]);
  
  if (!account) {
    throw new Error('Conta não encontrada');
  }
  
  console.log(`🔐 [SIGMA] Conta encontrada: ${account.name} (${account.domain})`);
  
  const now = new Date();
  const isValid = account.session_valid_until && new Date(account.session_valid_until) > now;
  
  console.log(`🔐 [SIGMA] Token no banco: ${account.auth_token ? 'SIM' : 'NÃO'}`);
  console.log(`🔐 [SIGMA] Sessão válida até: ${account.session_valid_until || 'N/A'}`);
  console.log(`🔐 [SIGMA] Sessão é válida: ${isValid}`);
  
  const service = new SigmaService(
    account.domain, 
    account.username, 
    account.password,
    isValid ? account.auth_token : null
  );
  
  // Se sessão expirou ou não tem token, fazer login
  if (!isValid || !account.auth_token) {
    console.log(`🔄 [SIGMA] Sessão expirada ou sem token, fazendo login...`);
    const loginResult = await service.login();
    
    // Atualizar token no banco
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);
    
    run(`
      UPDATE sigma_accounts 
      SET auth_token = ?, session_valid_until = ?
      WHERE id = ?
    `, [loginResult.token, validUntil.toISOString(), accountId]);
    
    console.log(`✅ [SIGMA] Token atualizado no banco, válido até: ${validUntil.toISOString()}`);
  } else {
    console.log(`✅ [SIGMA] Usando token existente do banco`);
  }
  
  return { service, account };
}

// Listar clientes de uma conta
router.get('/accounts/:id/customers', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 50, search = '' } = req.query;
    
    const { service, account } = await getAuthenticatedService(id);
    
    const result = await service.getCustomers(
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
    
    const { service } = await getAuthenticatedService(id);
    
    const customer = await service.getCustomerDetails(customerId);
    
    res.json({ success: true, customer });
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro ao buscar cliente' 
    });
  }
});

// ==================== PACOTES ====================

// Buscar pacotes disponíveis
router.get('/accounts/:id/packages', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { service, account } = await getAuthenticatedService(id);
    
    const { servers, packages } = await service.getServersAndPackages();
    
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
    
    const { service, account } = await getAuthenticatedService(id);
    
    console.log(`🔄 [SIGMA] Renovando cliente ${customerId} na conta ${account.name}`);
    
    const result = await service.renewCustomer(customerId, package_id, connections);
    
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

// ==================== REVENDEDORES ====================

// Listar revendedores de uma conta - SIMPLIFICADO (igual a clientes)
router.get('/accounts/:id/resellers', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 20, search = '' } = req.query;
    
    const { service, account } = await getAuthenticatedService(id);
    
    const result = await service.getResellers(
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

// Adicionar créditos a um revendedor
router.post('/accounts/:id/resellers/:resellerId/add-credits', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;
    
    if (!credits || credits <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantidade de créditos deve ser maior que zero' 
      });
    }
    
    const { service, account } = await getAuthenticatedService(id);
    
    console.log(`💰 [SIGMA] Adicionando ${credits} créditos ao revendedor ${resellerId} na conta ${account.name}`);
    
    const result = await service.addCredits(resellerId, credits);
    
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

// Remover créditos de um revendedor
router.post('/accounts/:id/resellers/:resellerId/remove-credits', async (req, res) => {
  try {
    const { id, resellerId } = req.params;
    const { credits } = req.body;
    
    if (!credits || credits <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantidade de créditos deve ser maior que zero' 
      });
    }
    
    const { service, account } = await getAuthenticatedService(id);
    
    console.log(`💸 [SIGMA] Removendo ${credits} créditos do revendedor ${resellerId} na conta ${account.name}`);
    
    const result = await service.removeCredits(resellerId, credits);
    
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