// =============================================
// SIGMA SESSION KEEPER
// Mantém sessões Sigma ativas em background
// CORRIGIDO: Salva token no banco após re-login
// =============================================

import SigmaSession from './sigma-session.js';
import { run, get, all } from '../../config/database.js';

class SigmaKeeper {
  constructor() {
    this.sessions = new Map(); // accountId -> SigmaSession
    this.interval = null;
    this.pingInterval = 2 * 60 * 1000; // 2 minutos
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SigmaKeeper] [${level}] ${message}`);
  }

  // =============================================
  // START/STOP
  // =============================================
  start() {
    if (this.interval) {
      this.log('Keeper já está rodando');
      return;
    }

    this.log(`🚀 Iniciando keeper (intervalo: ${this.pingInterval / 1000}s)`);

    // Carregar sessões existentes do banco
    this.loadSessionsFromDB();

    // Iniciar loop de ping
    this.interval = setInterval(() => this.pingAll(), this.pingInterval);
    
    // Primeiro ping imediato
    setTimeout(() => this.pingAll(), 5000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.log('⏹️ Keeper parado');
    }
  }

  // =============================================
  // LOAD SESSIONS FROM DB
  // =============================================
  loadSessionsFromDB() {
    try {
      const accounts = all(`
        SELECT * FROM sigma_accounts 
        WHERE auth_token IS NOT NULL 
        AND session_valid_until > datetime('now')
      `);

      this.log(`📂 Encontradas ${accounts.length} contas com sessão válida no banco`);

      for (const account of accounts) {
        this.addSession(account);
      }
    } catch (error) {
      this.log(`Erro ao carregar sessões: ${error.message}`, 'ERROR');
    }
  }

  // =============================================
  // SESSION MANAGEMENT
  // =============================================
  addSession(account) {
    if (this.sessions.has(account.id)) {
      this.log(`Sessão ${account.id} já existe, atualizando...`);
      this.sessions.delete(account.id);
    }

    const session = new SigmaSession(account);
    this.sessions.set(account.id, session);
    
    this.log(`➕ Sessão ${account.id} adicionada ao keeper (total: ${this.sessions.size})`);
    
    return session;
  }

  removeSession(accountId) {
    if (this.sessions.has(accountId)) {
      this.sessions.delete(accountId);
      this.log(`➖ Sessão ${accountId} removida do keeper (total: ${this.sessions.size})`);
    }
  }

  getSession(accountId) {
    return this.sessions.get(accountId);
  }

  // =============================================
  // PING ALL SESSIONS
  // =============================================
  async pingAll() {
    if (this.sessions.size === 0) {
      return;
    }

    this.log(`📋 Iniciando ping em ${this.sessions.size} sessão(ões)...`);

    let successCount = 0;
    let failCount = 0;

    for (const [accountId, session] of this.sessions) {
      try {
        const wasLoggedIn = session.loggedIn;
        const oldToken = session.getToken();
        
        const isActive = await session.ping();
        const info = session.getSessionInfo();
        
        // Verificar se houve re-login (token mudou)
        const newToken = session.getToken();
        if (newToken && newToken !== oldToken) {
          this.log(`🔄 Sessão ${accountId}: token renovado, salvando no banco...`);
          await this.saveTokenToDB(accountId, newToken);
        }

        if (isActive) {
          this.log(`✅ Sessão ${accountId}: ativa (${info.duration}min)`, 'SUCCESS');
          successCount++;
        } else {
          this.log(`⚠️ Sessão ${accountId}: inativa`, 'WARN');
          failCount++;
        }
      } catch (error) {
        this.log(`❌ Sessão ${accountId}: erro - ${error.message}`, 'ERROR');
        failCount++;
      }
    }

    this.log(`📊 Ping concluído: ${successCount} OK, ${failCount} falhas`);
  }

  // =============================================
  // SAVE TOKEN TO DATABASE
  // =============================================
  async saveTokenToDB(accountId, token) {
    try {
      const validUntil = new Date();
      validUntil.setHours(validUntil.getHours() + 24);

      run(`
        UPDATE sigma_accounts 
        SET auth_token = ?, session_valid_until = ?
        WHERE id = ?
      `, [token, validUntil.toISOString(), accountId]);

      this.log(`💾 Token salvo no banco para conta ${accountId}`);
    } catch (error) {
      this.log(`Erro ao salvar token: ${error.message}`, 'ERROR');
    }
  }

  // =============================================
  // GET STATUS
  // =============================================
  getStatus() {
    const sessionsInfo = [];
    
    for (const [accountId, session] of this.sessions) {
      sessionsInfo.push({
        accountId,
        ...session.getSessionInfo()
      });
    }

    return {
      running: !!this.interval,
      pingInterval: this.pingInterval,
      totalSessions: this.sessions.size,
      sessions: sessionsInfo
    };
  }
}

// Singleton
const sigmaKeeper = new SigmaKeeper();

export default sigmaKeeper;
export { SigmaKeeper };
