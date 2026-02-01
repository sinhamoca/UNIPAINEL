// =============================================
// KOFFICE SESSION KEEPER
// Mantém todas as sessões Koffice ativas
// =============================================

class KofficeSessionKeeper {
  constructor() {
    this.sessions = new Map();  // accountId -> { session, api, lastPing, failures }
    this.interval = null;
    this.checkIntervalMs = 2 * 60 * 1000;  // 2 minutos (mesmo do koffice-bot original)
    this.maxFailures = 3;  // Máximo de falhas antes de desistir
    this.isRunning = false;
  }

  // =============================================
  // LOGGING
  // =============================================
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KofficeKeeper] [${level}] ${message}`);
  }

  // =============================================
  // START
  // =============================================
  start() {
    if (this.isRunning) {
      this.log('Session keeper já está rodando');
      return;
    }

    this.log(`Iniciando session keeper (intervalo: ${this.checkIntervalMs / 1000}s)`);
    this.isRunning = true;

    // Fazer ping inicial em todas as sessões
    this.pingAll();

    // Iniciar loop de verificação
    this.interval = setInterval(() => {
      this.pingAll();
    }, this.checkIntervalMs);

    this.log('Session keeper iniciado!', 'SUCCESS');
  }

  // =============================================
  // STOP
  // =============================================
  stop() {
    if (!this.isRunning) {
      this.log('Session keeper não está rodando');
      return;
    }

    this.log('Parando session keeper...');

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    this.log('Session keeper parado', 'SUCCESS');
  }

  // =============================================
  // ADD SESSION
  // =============================================
  addSession(accountId, session, api = null) {
    if (this.sessions.has(accountId)) {
      this.log(`Sessão ${accountId} já existe, atualizando...`);
    }

    this.sessions.set(accountId, {
      session,
      api,
      lastPing: null,
      failures: 0,
      addedAt: Date.now()
    });

    this.log(`Sessão ${accountId} adicionada ao keeper (total: ${this.sessions.size})`);

    // Se keeper está rodando, fazer ping imediato na nova sessão
    if (this.isRunning) {
      this.pingSession(accountId).catch(err => {
        this.log(`Erro no ping inicial da sessão ${accountId}: ${err.message}`, 'ERROR');
      });
    }
  }

  // =============================================
  // REMOVE SESSION
  // =============================================
  removeSession(accountId) {
    if (!this.sessions.has(accountId)) {
      return false;
    }

    this.sessions.delete(accountId);
    this.log(`Sessão ${accountId} removida do keeper (total: ${this.sessions.size})`);
    return true;
  }

  // =============================================
  // GET SESSION
  // =============================================
  getSession(accountId) {
    return this.sessions.get(accountId) || null;
  }

  // =============================================
  // HAS SESSION
  // =============================================
  hasSession(accountId) {
    return this.sessions.has(accountId);
  }

  // =============================================
  // PING ALL SESSIONS
  // =============================================
  async pingAll() {
    if (this.sessions.size === 0) {
      return;
    }

    this.log(`Fazendo ping em ${this.sessions.size} sessão(ões)...`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    // Processar sessões em série para não sobrecarregar
    for (const [accountId, data] of this.sessions) {
      try {
        const success = await this.pingSession(accountId);
        if (success) {
          results.success++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        this.log(`Erro ao fazer ping na sessão ${accountId}: ${error.message}`, 'ERROR');
      }

      // Pequeno delay entre pings para não sobrecarregar
      await this.delay(500);
    }

    this.log(`Ping concluído: ${results.success} OK, ${results.failed} falhas`);
  }

  // =============================================
  // PING SINGLE SESSION
  // =============================================
  async pingSession(accountId) {
    const data = this.sessions.get(accountId);
    if (!data) {
      return false;
    }

    const { session } = data;

    try {
      // Usar o método ping da sessão (que faz checkSession internamente)
      const isActive = await session.ping();
      
      data.lastPing = Date.now();

      if (isActive) {
        data.failures = 0;
        
        const info = session.getSessionInfo();
        this.log(`Sessão ${accountId}: ativa (${info.duration}min)`, 'SUCCESS');
        return true;
      } else {
        data.failures++;
        this.log(`Sessão ${accountId}: inativa (falhas: ${data.failures})`, 'WARN');

        // Se atingiu máximo de falhas, remover do keeper
        if (data.failures >= this.maxFailures) {
          this.log(`Sessão ${accountId}: removendo após ${this.maxFailures} falhas`, 'ERROR');
          this.removeSession(accountId);
        }

        return false;
      }
    } catch (error) {
      data.failures++;
      data.lastPing = Date.now();
      
      this.log(`Sessão ${accountId}: erro (${error.message})`, 'ERROR');

      if (data.failures >= this.maxFailures) {
        this.log(`Sessão ${accountId}: removendo após ${this.maxFailures} falhas`, 'ERROR');
        this.removeSession(accountId);
      }

      return false;
    }
  }

  // =============================================
  // GET STATUS
  // =============================================
  getStatus() {
    const sessionsStatus = [];

    for (const [accountId, data] of this.sessions) {
      const info = data.session.getSessionInfo();
      sessionsStatus.push({
        accountId,
        loggedIn: info.loggedIn,
        duration: info.duration,
        lastPing: data.lastPing,
        failures: data.failures,
        addedAt: data.addedAt
      });
    }

    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
      totalSessions: this.sessions.size,
      sessions: sessionsStatus
    };
  }

  // =============================================
  // SET CHECK INTERVAL
  // =============================================
  setCheckInterval(ms) {
    this.checkIntervalMs = ms;
    
    // Se está rodando, reiniciar com novo intervalo
    if (this.isRunning) {
      this.stop();
      this.start();
    }

    this.log(`Intervalo alterado para ${ms / 1000}s`);
  }

  // =============================================
  // UTILITY
  // =============================================
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================
// SINGLETON EXPORT
// =============================================
const sessionKeeper = new KofficeSessionKeeper();

export { KofficeSessionKeeper };
export default sessionKeeper;
