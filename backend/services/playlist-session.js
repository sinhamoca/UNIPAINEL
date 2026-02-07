// services/playlist-session.js - Gerenciador de Sessões do Playlist Manager
import { run, get, all } from '../config/database.js';

// Cache em memória para sessões ativas
const sessionCache = new Map();

// Políticas de expiração por player (em horas)
const SESSION_POLICIES = {
  iboplayer: {
    expiresInHours: parseInt(process.env.SESSION_EXPIRY_IBOPLAYER) || 72,
    testBeforeUse: true
  },
  ibopro: {
    expiresInHours: parseInt(process.env.SESSION_EXPIRY_IBOPRO) || 168,
    testBeforeUse: true
  },
  vuplayer: {
    expiresInHours: parseInt(process.env.SESSION_EXPIRY_VUPLAYER) || 72,
    testBeforeUse: true
  }
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function getCacheKey(clientId) {
  return `client_${clientId}`;
}

function isSessionExpired(session) {
  if (!session || !session.expiresAt) return true;
  return new Date(session.expiresAt) < new Date();
}

function getHoursUntilExpiry(session) {
  if (!session || !session.expiresAt) return 0;
  const now = new Date();
  const expires = new Date(session.expiresAt);
  const diff = expires - now;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

// ========================================
// SALVAR SESSÃO
// ========================================

async function saveSession(clientId, playerType, sessionData) {
  const policy = SESSION_POLICIES[playerType];
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + policy.expiresInHours);
  
  const session = {
    clientId,
    playerType,
    sessionData,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastUsed: new Date().toISOString()
  };
  
  // Salvar no cache
  const cacheKey = getCacheKey(clientId);
  sessionCache.set(cacheKey, session);
  
  // Salvar no banco de dados
  try {
    run(`
      UPDATE playlist_clients 
      SET has_active_session = 1,
          session_data = ?,
          session_expires_at = ?,
          last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify(sessionData), expiresAt.toISOString(), clientId]);
  } catch (error) {
    console.error('Erro ao salvar sessão no banco:', error.message);
  }
  
  console.log(`✅ Sessão salva: Cliente ${clientId} (${playerType}), expira em ${policy.expiresInHours}h`);
  
  return session;
}

// ========================================
// CARREGAR SESSÃO
// ========================================

async function loadSession(clientId) {
  const cacheKey = getCacheKey(clientId);
  
  // Tentar do cache primeiro
  if (sessionCache.has(cacheKey)) {
    const session = sessionCache.get(cacheKey);
    session.lastUsed = new Date().toISOString();
    return session;
  }
  
  // Tentar do banco de dados
  try {
    const client = get(`
      SELECT id, player_type, session_data, session_expires_at, has_active_session
      FROM playlist_clients
      WHERE id = ? AND has_active_session = 1 AND session_data IS NOT NULL
    `, [clientId]);
    
    if (client && client.session_data) {
      const session = {
        clientId: client.id,
        playerType: client.player_type,
        sessionData: JSON.parse(client.session_data),
        expiresAt: client.session_expires_at,
        lastUsed: new Date().toISOString()
      };
      
      // Salvar no cache
      sessionCache.set(cacheKey, session);
      
      return session;
    }
  } catch (error) {
    console.error('Erro ao carregar sessão do banco:', error.message);
  }
  
  return null;
}

// ========================================
// DELETAR SESSÃO
// ========================================

async function deleteSession(clientId) {
  const cacheKey = getCacheKey(clientId);
  
  // Remover do cache
  sessionCache.delete(cacheKey);
  
  // Remover do banco
  try {
    run(`
      UPDATE playlist_clients 
      SET has_active_session = 0,
          session_data = NULL,
          session_expires_at = NULL
      WHERE id = ?
    `, [clientId]);
    
    console.log(`🗑️ Sessão deletada: Cliente ${clientId}`);
  } catch (error) {
    console.error('Erro ao deletar sessão do banco:', error.message);
  }
}

// ========================================
// OBTER SESSÃO VÁLIDA (PRINCIPAL)
// ========================================

async function getValidSession(client, loginFunction) {
  const { id, player_type } = client;
  
  // 1. Tentar carregar do cache/banco
  const cachedSession = await loadSession(id);
  
  if (!cachedSession) {
    console.log(`🔐 Cliente ${id}: Nenhuma sessão em cache, fazendo login...`);
    return await loginAndSaveSession(client, loginFunction);
  }
  
  // 2. Verificar expiração
  if (isSessionExpired(cachedSession)) {
    console.log(`⏰ Cliente ${id}: Sessão expirada, renovando...`);
    await deleteSession(id);
    return await loginAndSaveSession(client, loginFunction);
  }
  
  // 3. Testar se ainda funciona
  const policy = SESSION_POLICIES[player_type];
  if (policy.testBeforeUse) {
    const isValid = await testSessionForPlayer(cachedSession, player_type);
    
    if (!isValid) {
      console.log(`❌ Cliente ${id}: Sessão inválida, fazendo novo login...`);
      await deleteSession(id);
      return await loginAndSaveSession(client, loginFunction);
    }
  }
  
  // 4. Sessão válida!
  const hoursLeft = getHoursUntilExpiry(cachedSession);
  console.log(`✅ Cliente ${id}: Sessão em cache válida! (${hoursLeft}h restantes)`);
  
  // Atualizar último uso
  updateLastUsed(id);
  
  return cachedSession;
}

// ========================================
// LOGIN E SALVAR
// ========================================

async function loginAndSaveSession(client, loginFunction) {
  console.log(`🔐 Cliente ${client.id}: Fazendo login...`);
  
  try {
    const sessionData = await loginFunction(client);
    const session = await saveSession(client.id, client.player_type, sessionData);
    
    // Log da ação
    logAction(client.user_id, client.id, 'login', 'Login realizado com sucesso');
    
    return session;
  } catch (error) {
    // Log do erro
    logAction(client.user_id, client.id, 'login_failed', error.message, false);
    throw error;
  }
}

// ========================================
// TESTAR SESSÃO POR PLAYER
// ========================================

async function testSessionForPlayer(session, playerType) {
  try {
    switch (playerType) {
      case 'iboplayer':
        const iboplayer = (await import('./playlist-iboplayer.js')).default;
        return await iboplayer.testSession(session.sessionData);
      
      case 'ibopro':
        // IBOPro: testar listando playlists
        const ibopro = (await import('./playlist-ibopro.js')).default;
        try {
          await ibopro.listPlaylists(session.sessionData);
          return true;
        } catch (e) {
          return false;
        }
      
      case 'vuplayer':
        // VUPlayer: testar acessando /mylist
        const vuplayer = (await import('./playlist-vuplayer.js')).default;
        return await vuplayer.testSession(session.sessionData);
      
      default:
        return false;
    }
  } catch (error) {
    console.error(`Erro ao testar sessão ${playerType}:`, error.message);
    return false;
  }
}

// ========================================
// ATUALIZAR ÚLTIMO USO
// ========================================

function updateLastUsed(clientId) {
  try {
    run(`
      UPDATE playlist_clients 
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [clientId]);
  } catch (error) {
    console.error('Erro ao atualizar último uso:', error.message);
  }
}

// ========================================
// LIMPAR SESSÕES EXPIRADAS
// ========================================

async function cleanExpiredSessions() {
  let cleaned = 0;
  
  // Limpar do cache
  for (const [key, session] of sessionCache.entries()) {
    if (isSessionExpired(session)) {
      sessionCache.delete(key);
      cleaned++;
    }
  }
  
  // Limpar do banco
  try {
    const result = run(`
      UPDATE playlist_clients 
      SET has_active_session = 0,
          session_data = NULL,
          session_expires_at = NULL
      WHERE has_active_session = 1 
        AND session_expires_at < CURRENT_TIMESTAMP
    `);
    
    cleaned += result.changes || 0;
  } catch (error) {
    console.error('Erro ao limpar sessões expiradas:', error.message);
  }
  
  if (cleaned > 0) {
    console.log(`🗑️ ${cleaned} sessão(ões) expirada(s) limpas`);
  }
  
  return cleaned;
}

// ========================================
// LOG DE AÇÕES
// ========================================

function logAction(userId, clientId, action, details, success = true) {
  try {
    run(`
      INSERT INTO playlist_logs (user_id, client_id, action, details, success)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, clientId, action, details, success ? 1 : 0]);
  } catch (error) {
    console.error('Erro ao registrar log:', error.message);
  }
}

// ========================================
// ESTATÍSTICAS
// ========================================

function getSessionStats() {
  return {
    cacheSize: sessionCache.size,
    activeSessions: Array.from(sessionCache.values()).filter(s => !isSessionExpired(s)).length
  };
}

export {
  saveSession,
  loadSession,
  deleteSession,
  getValidSession,
  cleanExpiredSessions,
  getSessionStats,
  logAction,
  getHoursUntilExpiry,
  SESSION_POLICIES
};
