-- =============================================
-- UniPanel Database Schema
-- Começando com IBO Revenda (GerenciaApp)
-- =============================================

-- Tabela de usuários do sistema (autenticação)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- IBO REVENDA (GerenciaApp)
-- =============================================

-- Contas do GerenciaApp (múltiplas contas)
CREATE TABLE IF NOT EXISTS gerencia_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  base_url TEXT DEFAULT 'https://www.gerenciaapp.top',
  is_active INTEGER DEFAULT 1,
  
  -- Dados da sessão persistente
  session_cookies TEXT,
  session_xsrf_token TEXT,
  session_inertia_version TEXT,
  session_valid_until TEXT,
  last_login_at TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cache de usuários do GerenciaApp (para busca rápida)
CREATE TABLE IF NOT EXISTS gerencia_users_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  remote_id INTEGER NOT NULL,
  server_name TEXT,
  mac_device TEXT,
  email TEXT,
  m3u8_list TEXT,
  dns TEXT,
  expire_date TEXT,
  whatsapp TEXT,
  plan_id INTEGER,
  modo_selecao INTEGER,
  raw_data TEXT,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES gerencia_accounts(id) ON DELETE CASCADE
);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_gerencia_cache_unique ON gerencia_users_cache(account_id, remote_id);

-- Logs de ações do GerenciaApp
CREATE TABLE IF NOT EXISTS gerencia_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  target_user_name TEXT,
  details TEXT,
  success INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES gerencia_accounts(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gerencia_accounts_user ON gerencia_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_gerencia_cache_account ON gerencia_users_cache(account_id);
CREATE INDEX IF NOT EXISTS idx_gerencia_logs_account ON gerencia_logs(account_id);

-- =============================================
-- KOFFICE
-- =============================================

-- Contas do Koffice (múltiplas contas)
CREATE TABLE IF NOT EXISTS koffice_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  has_captcha INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  
  -- Dados da sessão persistente
  session_cookies TEXT,
  session_valid_until TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cache de clientes do Koffice (para busca rápida)
CREATE TABLE IF NOT EXISTS koffice_clients_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  remote_id TEXT NOT NULL,
  username TEXT,
  password TEXT,
  name TEXT,
  created_at_remote TEXT,
  expires_at TEXT,
  reseller TEXT,
  screens TEXT,
  status TEXT,
  raw_data TEXT,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES koffice_accounts(id) ON DELETE CASCADE
);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_koffice_cache_unique ON koffice_clients_cache(account_id, remote_id);

-- Logs de ações do Koffice
CREATE TABLE IF NOT EXISTS koffice_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_client_id TEXT,
  target_client_name TEXT,
  details TEXT,
  success INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES koffice_accounts(id) ON DELETE CASCADE
);

-- Índices Koffice
CREATE INDEX IF NOT EXISTS idx_koffice_accounts_user ON koffice_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_koffice_cache_account ON koffice_clients_cache(account_id);
CREATE INDEX IF NOT EXISTS idx_koffice_logs_account ON koffice_logs(account_id);

-- =============================================
-- PLAYLIST MANAGER (IBOPlayer, IBOPro, VUPlayer)
-- =============================================

-- Domínios pré-cadastrados (para IBOPlayer multi-domínio)
CREATE TABLE IF NOT EXISTS playlist_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice único para domínio por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_domains_unique ON playlist_domains(user_id, domain);

-- Clientes (dispositivos) do Playlist Manager
CREATE TABLE IF NOT EXISTS playlist_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  server_id INTEGER,
  name TEXT NOT NULL,
  player_type TEXT NOT NULL CHECK(player_type IN ('iboplayer', 'ibopro', 'vuplayer')),
  mac_address TEXT NOT NULL,
  device_key TEXT,
  password TEXT,
  domain TEXT,
  notes TEXT,
  
  -- Controle de sessão
  has_active_session INTEGER DEFAULT 0,
  session_data TEXT,
  session_expires_at TEXT,
  last_login_at TEXT,
  last_used_at TEXT,
  
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES playlist_servers(id) ON DELETE SET NULL
);

-- Índices para busca rápida de clientes
CREATE INDEX IF NOT EXISTS idx_playlist_clients_user ON playlist_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_clients_name ON playlist_clients(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_playlist_clients_mac ON playlist_clients(mac_address);
CREATE INDEX IF NOT EXISTS idx_playlist_clients_type ON playlist_clients(player_type);

-- Logs de ações do Playlist Manager
CREATE TABLE IF NOT EXISTS playlist_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  client_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  success INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES playlist_clients(id) ON DELETE SET NULL
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_playlist_logs_user ON playlist_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_logs_client ON playlist_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_playlist_logs_created ON playlist_logs(created_at DESC);

-- =============================================
-- PLAYLIST SERVERS (Tags/Grupos para organizar clientes)
-- =============================================

-- Servidores (grupos/tags) para organizar clientes
CREATE TABLE IF NOT EXISTS playlist_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '🔵',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para busca de servidores
CREATE INDEX IF NOT EXISTS idx_playlist_servers_user ON playlist_servers(user_id);

-- =============================================
-- SIGMA (Painéis Sigma)
-- =============================================

-- Contas do Sigma (múltiplas contas/painéis)
CREATE TABLE IF NOT EXISTS sigma_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_alt TEXT,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  auth_token TEXT,
  session_valid_until DATETIME,
  last_working_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(domain, username)
);

-- Índice para busca por domínio
CREATE INDEX IF NOT EXISTS idx_sigma_accounts_domain ON sigma_accounts(domain);

-- =============================================
-- UNIPLAY (GesAPIOffice / GesDefender)
-- =============================================

-- Contas do Uniplay (múltiplas contas)
CREATE TABLE IF NOT EXISTS uniplay_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices Uniplay
CREATE INDEX IF NOT EXISTS idx_uniplay_accounts_user ON uniplay_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_uniplay_accounts_active ON uniplay_accounts(is_active);

-- =============================================
-- WORKFLOWS (Automações integradas)
-- =============================================

-- Tabela de workflows configurados
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de logs de execução de workflows
CREATE TABLE IF NOT EXISTS workflow_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  input_data TEXT,
  output_data TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(type);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_user ON workflow_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created ON workflow_logs(created_at DESC);