// config/database.js
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'unipanel.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

let db = null;

// Criar diretório se não existir
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Salvar banco periodicamente
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save a cada 30 segundos
setInterval(saveDatabase, 30000);

// Salvar ao sair
process.on('exit', saveDatabase);
process.on('SIGINT', () => { saveDatabase(); process.exit(); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(); });

// Inicializar banco de dados
export async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('✅ Banco de dados carregado');
  } else {
    db = new SQL.Database();
    console.log('✅ Novo banco de dados criado');
  }
  
  // Executar schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.run(schema);
  saveDatabase();
  
  console.log('✅ Schema aplicado');
  return db;
}

// Helper para executar queries
function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    
    // Obter lastID de forma mais segura
    let lastID = null;
    try {
      const result = db.exec("SELECT last_insert_rowid() as id");
      if (result && result[0] && result[0].values && result[0].values[0]) {
        lastID = result[0].values[0][0];
      }
    } catch (e) {
      console.log('Aviso: não foi possível obter lastID:', e.message);
    }
    
    // Obter changes de forma mais segura
    let changes = 0;
    try {
      changes = db.getRowsModified();
    } catch (e) {
      console.log('Aviso: não foi possível obter changes:', e.message);
    }
    
    return { lastID, changes };
  } catch (error) {
    console.error('Erro em run():', error);
    throw error;
  }
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Exportar funções básicas
export { run, get, all };

// =============================================
// USERS (Autenticação do sistema)
// =============================================

export function createUser(username, hashedPassword, name = null) {
  run(`
    INSERT INTO users (username, password, name)
    VALUES (?, ?, ?)
  `, [username, hashedPassword, name]);
  
  const result = get('SELECT last_insert_rowid() as id');
  return result?.id;
}

export function getUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

export function getUserById(id) {
  return get('SELECT id, username, name, is_active, created_at FROM users WHERE id = ?', [id]);
}

// =============================================
// GERENCIA ACCOUNTS (Contas do GerenciaApp)
// =============================================

export function createGerenciaAccount(userId, data) {
  run(`
    INSERT INTO gerencia_accounts (user_id, name, email, password, base_url)
    VALUES (?, ?, ?, ?, ?)
  `, [
    userId,
    data.name,
    data.email,
    data.password,
    data.baseUrl || 'https://www.gerenciaapp.top'
  ]);
  
  const result = get('SELECT last_insert_rowid() as id');
  return result?.id;
}

export function getGerenciaAccounts(userId) {
  return all(`
    SELECT id, name, email, base_url, is_active, last_login_at, 
           session_valid_until, created_at
    FROM gerencia_accounts 
    WHERE user_id = ? 
    ORDER BY name ASC
  `, [userId]);
}

export function getGerenciaAccountById(id, userId) {
  return get(`
    SELECT * FROM gerencia_accounts 
    WHERE id = ? AND user_id = ?
  `, [id, userId]);
}

export function getGerenciaAccountFull(id) {
  return get('SELECT * FROM gerencia_accounts WHERE id = ?', [id]);
}

export function updateGerenciaAccount(id, userId, data) {
  const allowedFields = ['name', 'email', 'password', 'base_url', 'is_active'];
  const fields = Object.keys(data).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) return false;
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => data[f]), id, userId];
  
  run(`
    UPDATE gerencia_accounts 
    SET ${setClause} 
    WHERE id = ? AND user_id = ?
  `, values);
  
  return true;
}

export function updateGerenciaSession(id, sessionData) {
  run(`
    UPDATE gerencia_accounts 
    SET session_cookies = ?,
        session_xsrf_token = ?,
        session_inertia_version = ?,
        session_valid_until = ?,
        last_login_at = datetime('now')
    WHERE id = ?
  `, [
    sessionData.cookies,
    sessionData.xsrfToken,
    sessionData.inertiaVersion,
    sessionData.validUntil,
    id
  ]);
}

export function clearGerenciaSession(id) {
  run(`
    UPDATE gerencia_accounts 
    SET session_cookies = NULL,
        session_xsrf_token = NULL,
        session_inertia_version = NULL,
        session_valid_until = NULL
    WHERE id = ?
  `, [id]);
}

export function deleteGerenciaAccount(id, userId) {
  run('DELETE FROM gerencia_accounts WHERE id = ? AND user_id = ?', [id, userId]);
  return true;
}

// =============================================
// GERENCIA USERS CACHE
// =============================================

export function upsertGerenciaUserCache(accountId, user) {
  // Primeiro tenta deletar se existir
  run('DELETE FROM gerencia_users_cache WHERE account_id = ? AND remote_id = ?', [accountId, user.id]);
  
  // Depois insere
  run(`
    INSERT INTO gerencia_users_cache 
      (account_id, remote_id, server_name, mac_device, email, m3u8_list, dns, expire_date, whatsapp, plan_id, modo_selecao, raw_data, cached_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    accountId,
    user.id,
    user.server_name,
    user.mac_device,
    user.email,
    user.m3u8_list,
    user.dns,
    user.expire_date || user.expire_account,
    user.whatsapp,
    user.plan_id,
    user.modo_selecao,
    JSON.stringify(user)
  ]);
}

export function searchGerenciaUsersCache(accountId, query, limit = 20) {
  const pattern = `%${query}%`;
  return all(`
    SELECT * FROM gerencia_users_cache
    WHERE account_id = ? 
      AND (server_name LIKE ? OR mac_device LIKE ? OR email LIKE ?)
    ORDER BY server_name ASC
    LIMIT ?
  `, [accountId, pattern, pattern, pattern, limit]);
}

export function getGerenciaUserCacheById(accountId, remoteId) {
  return get(`
    SELECT * FROM gerencia_users_cache
    WHERE account_id = ? AND remote_id = ?
  `, [accountId, remoteId]);
}

export function deleteGerenciaUserCache(accountId, remoteId) {
  run('DELETE FROM gerencia_users_cache WHERE account_id = ? AND remote_id = ?', [accountId, remoteId]);
}

export function clearGerenciaUserCache(accountId) {
  run('DELETE FROM gerencia_users_cache WHERE account_id = ?', [accountId]);
}

// =============================================
// GERENCIA LOGS
// =============================================

export function logGerenciaAction(accountId, action, targetUserId, targetUserName, details, success = true) {
  run(`
    INSERT INTO gerencia_logs (account_id, action, target_user_id, target_user_name, details, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [accountId, action, targetUserId, targetUserName, details, success ? 1 : 0]);
}

export function getGerenciaLogs(accountId, limit = 50) {
  return all(`
    SELECT * FROM gerencia_logs
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [accountId, limit]);
}

// =============================================
// STATS
// =============================================

export function getGerenciaStats(accountId) {
  const total = get(`
    SELECT COUNT(*) as count FROM gerencia_users_cache WHERE account_id = ?
  `, [accountId]);
  
  const active = get(`
    SELECT COUNT(*) as count FROM gerencia_users_cache 
    WHERE account_id = ? AND date(expire_date) >= date('now')
  `, [accountId]);
  
  const expiringSoon = get(`
    SELECT COUNT(*) as count FROM gerencia_users_cache 
    WHERE account_id = ? 
      AND date(expire_date) >= date('now') 
      AND date(expire_date) <= date('now', '+7 days')
  `, [accountId]);
  
  const expired = get(`
    SELECT COUNT(*) as count FROM gerencia_users_cache 
    WHERE account_id = ? AND date(expire_date) < date('now')
  `, [accountId]);
  
  const recentActions = get(`
    SELECT COUNT(*) as count FROM gerencia_logs 
    WHERE account_id = ? AND created_at >= datetime('now', '-24 hours')
  `, [accountId]);
  
  return {
    total: total?.count || 0,
    active: active?.count || 0,
    expiringSoon: expiringSoon?.count || 0,
    expired: expired?.count || 0,
    recentActions: recentActions?.count || 0
  };
}

// =============================================
// KOFFICE ACCOUNTS
// =============================================

export function createKofficeAccount(userId, data) {
  run(`
    INSERT INTO koffice_accounts (user_id, name, domain, username, password, has_captcha)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    userId,
    data.name,
    data.domain,
    data.username,
    data.password,
    data.hasCaptcha ? 1 : 0
  ]);
  
  const result = get('SELECT last_insert_rowid() as id');
  return result?.id;
}

export function getKofficeAccounts(userId) {
  return all(`
    SELECT id, name, domain, username, has_captcha, is_active,
           session_valid_until, login_count, last_login_at, created_at
    FROM koffice_accounts 
    WHERE user_id = ? 
    ORDER BY name ASC
  `, [userId]);
}

export function getKofficeAccountById(id, userId) {
  return get(`
    SELECT * FROM koffice_accounts 
    WHERE id = ? AND user_id = ?
  `, [id, userId]);
}

export function getKofficeAccountFull(id) {
  return get('SELECT * FROM koffice_accounts WHERE id = ?', [id]);
}

export function updateKofficeAccount(id, userId, data) {
  const allowedFields = ['name', 'domain', 'username', 'password', 'has_captcha', 'is_active'];
  const fields = Object.keys(data).filter(key => allowedFields.includes(key));
  
  if (fields.length === 0) return false;
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => data[f]), id, userId];
  
  run(`
    UPDATE koffice_accounts 
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `, values);
  
  return true;
}

export function updateKofficeSession(id, sessionData) {
  run(`
    UPDATE koffice_accounts 
    SET session_cookies = ?,
        session_valid_until = ?,
        login_count = login_count + 1,
        last_login_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `, [
    sessionData.cookies,
    sessionData.validUntil,
    id
  ]);
}

export function clearKofficeSession(id) {
  run(`
    UPDATE koffice_accounts 
    SET session_cookies = NULL,
        session_valid_until = NULL
    WHERE id = ?
  `, [id]);
}

export function deleteKofficeAccount(id, userId) {
  run('DELETE FROM koffice_accounts WHERE id = ? AND user_id = ?', [id, userId]);
  return true;
}

// =============================================
// KOFFICE LOGS
// =============================================

export function logKofficeAction(accountId, action, targetClientId, targetClientName, details, success = true) {
  run(`
    INSERT INTO koffice_logs (account_id, action, target_client_id, target_client_name, details, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [accountId, action, targetClientId, targetClientName, details, success ? 1 : 0]);
}

export function getKofficeLogs(accountId, limit = 50) {
  return all(`
    SELECT * FROM koffice_logs
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [accountId, limit]);
}

// =============================================
// KOFFICE STATS
// =============================================

export function getKofficeStats(accountId) {
  const cachedClients = get(`
    SELECT COUNT(*) as count FROM koffice_clients_cache WHERE account_id = ?
  `, [accountId]);
  
  const recentActions = get(`
    SELECT COUNT(*) as count FROM koffice_logs 
    WHERE account_id = ? AND created_at >= datetime('now', '-24 hours')
  `, [accountId]);
  
  return {
    cachedClients: cachedClients?.count || 0,
    recentActions: recentActions?.count || 0
  };
}

// Export default com funções básicas
export default { 
  initDatabase,
  run,
  get,
  all
};
