# 🎛️ UniPanel - Gerenciador Unificado

Sistema web para gerenciar painéis IPTV. Começando pelo **IBO Revenda (GerenciaApp)**.

## 📋 Funcionalidades do IBO Revenda

- ✅ Configurar múltiplas contas do GerenciaApp
- ✅ Persistência de sessão (não precisa logar toda vez)
- ✅ Buscar usuários em tempo real (estilo inline do Telegram)
- ✅ Criar usuário
- ✅ Editar usuário (nome, MAC, playlist, DNS, validade)
- ✅ Renovar usuário (adicionar dias)
- ✅ Deletar usuário
- ✅ Dashboard com estatísticas
- ✅ Cache local para busca rápida
- ✅ Logs de ações

## 🚀 Como Rodar

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

O backend vai rodar em `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend vai rodar em `http://localhost:5173`

### 3. Acessar

Abra `http://localhost:5173` no navegador.

## 📦 Estrutura do Projeto

```
unipanel/
├── backend/
│   ├── config/
│   │   └── database.js      # Configuração SQLite
│   ├── database/
│   │   ├── schema.sql       # Schema do banco
│   │   └── unipanel.db      # Banco de dados (criado automaticamente)
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── routes/
│   │   ├── auth.js          # Login/Register
│   │   └── gerencia.js      # Rotas do IBO Revenda
│   ├── services/
│   │   └── gerencia-client.js  # Cliente do GerenciaApp
│   ├── index.js             # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   └── gerencia/
│   │   │       ├── Accounts.jsx   # Configurar contas
│   │   │       ├── CreateUser.jsx # Criar usuário
│   │   │       └── Users.jsx      # Lista + busca
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
└── README.md
```

## 🔧 Primeiro Uso

1. **Crie uma conta** na tela de login (Register)
2. Vá em **IBO Revenda > Contas**
3. **Adicione sua conta** do GerenciaApp (email/senha)
4. Clique em **Conectar** para ativar a sessão
5. Pronto! Agora você pode gerenciar seus usuários

## 🔐 Segurança

- Senhas do GerenciaApp são armazenadas no banco local
- Sessões são persistidas para não precisar relogar
- JWT para autenticação do sistema

## 🛣️ Próximos Passos

- [ ] Adicionar Painéis Koffice
- [ ] Adicionar Playlist Manager
- [ ] Workflows cruzados entre sistemas

---

Desenvolvido para Isaac 🚀
