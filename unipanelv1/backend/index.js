// index.js
// UniPanel Backend - Entry Point

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carregar .env do diretório do backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Log para debug
console.log('[STARTUP] ANTICAPTCHA_KEY configurada:', process.env.ANTICAPTCHA_KEY ? 'SIM' : 'NÃO');

import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import gerenciaRoutes from './routes/gerencia.js';
import kofficeRoutes from './routes/koffice.js';
import playlistRoutes from './routes/playlist.js';
import sigmaRoutes from './routes/sigma.js';

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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Rota não encontrada' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Erro interno do servidor' 
  });
});

// ==================== START ====================

// Inicializar banco de dados e iniciar servidor
async function start() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           🚀 UniPanel Backend                     ║
╠═══════════════════════════════════════════════════╣
║  Status: Rodando                                  ║
║  Port: ${PORT}                                        ║
║  API: http://localhost:${PORT}/api                    ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);

export default app;
