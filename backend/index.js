// index.js
// UniPanel Backend - Entry Point

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import uniplayRoutes from './routes/uniplay.js';
import workflowsRouter from './routes/workflows.js';
import workflowTrialPlaylistRoutes from './routes/workflow-trial-playlist.js';

// Carregar .env do diretório do backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Log para debug
console.log('[STARTUP] ANTICAPTCHA_KEY configurada:', process.env.ANTICAPTCHA_KEY ? 'SIM' : 'NÃO');
console.log('[STARTUP] CLOUDFLARE_WORKER_URL:', process.env.CLOUDFLARE_WORKER_URL || 'usando padrão');

import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import gerenciaRoutes from './routes/gerencia.js';
import kofficeRoutes from './routes/koffice.js';
import playlistRoutes from './routes/playlist.js';
import sigmaRoutes from './routes/sigma.js';

// Importar Session Keeper do Koffice
import { startSessionKeeper, getKeeperStatus } from './services/koffice/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================

// CORS - aceitar requisições do frontend (localhost ou IP externo)
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requisições sem origin (como apps mobile ou curl)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Se a origem está na lista ou é do mesmo IP (qualquer porta)
    const originHost = new URL(origin).hostname;
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.includes('157.180.28.25') ||
                      originHost === 'localhost' ||
                      originHost === '127.0.0.1';
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS bloqueado:', origin);
      callback(null, true); // Permitir mesmo assim em desenvolvimento
    }
  },
  credentials: true
}));

// JSON parser - limite aumentado para OCR de imagens
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  const keeperStatus = getKeeperStatus();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    sessionKeeper: {
      running: keeperStatus.isRunning,
      activeSessions: keeperStatus.totalSessions
    }
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// GerenciaApp (IBO Revenda) routes
app.use('/api/gerencia', gerenciaRoutes);

// Koffice routes
app.use('/api/koffice', kofficeRoutes);

// Playlist Manager routes
app.use('/api/playlist', playlistRoutes);

// Sigma routes
app.use('/api/sigma', sigmaRoutes);

// Uniplay routes
app.use('/api/uniplay', uniplayRoutes);

// Workflows
app.use('/api/workflows', workflowsRouter);

//workflow playlist
app.use('/api/workflow/trial-playlist', workflowTrialPlaylistRoutes);

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint não encontrado' 
  });
});

// ==================== START SERVER ====================

async function startServer() {
  try {
    // Inicializar banco de dados
    console.log('📦 Inicializando banco de dados...');
    initDatabase();
    console.log('✅ Banco de dados inicializado');

    // Iniciar Session Keeper do Koffice
    console.log('🔄 Iniciando Koffice Session Keeper...');
    startSessionKeeper();
    console.log('✅ Koffice Session Keeper iniciado');

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('==========================================');
      console.log('   🎛️  UNIPANEL BACKEND');
      console.log('==========================================');
      console.log(`   📍 URL: http://localhost:${PORT}`);
      console.log(`   🌐 Externa: http://0.0.0.0:${PORT}`);
      console.log('   📊 Health: /api/health');
      console.log('');
      console.log('   📦 Módulos ativos:');
      console.log('      - IBO Revenda (GerenciaApp)');
      console.log('      - Koffice (com Session Keeper)');
      console.log('      - Playlist Manager');
      console.log('      - Sigma');
      console.log('==========================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Encerrando servidor...');
  process.exit(0);
});



// Iniciar
startServer();
