-- ========================================
-- UNIPLAY - Migração de Banco de Dados
-- Executar no SQLite do UniPanel
-- ========================================

-- Tabela de contas Uniplay
CREATE TABLE IF NOT EXISTS uniplay_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_uniplay_accounts_user ON uniplay_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_uniplay_accounts_active ON uniplay_accounts(is_active);

-- Verificar criação
SELECT 'Tabela uniplay_accounts criada com sucesso!' as status;
