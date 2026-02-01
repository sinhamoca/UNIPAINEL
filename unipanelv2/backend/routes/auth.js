// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import * as db from '../config/database.js';

const router = Router();

// POST /api/auth/register - Criar novo usuário
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e password são obrigatórios'
      });
    }
    
    // Verificar se usuário já existe
    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Username já está em uso'
      });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const userId = db.createUser(username, hashedPassword, name);
    
    // Gerar token
    const user = db.getUserById(userId);
    const token = generateToken(user);
    
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      },
      token
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar usuário'
    });
  }
});

// POST /api/auth/login - Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e password são obrigatórios'
      });
    }
    
    // Buscar usuário
    const user = db.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }
    
    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }
    
    // Verificar se está ativo
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Usuário desativado'
      });
    }
    
    // Gerar token
    const token = generateToken(user);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer login'
    });
  }
});

// GET /api/auth/me - Obter usuário atual
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    res.json({
      success: true,
      user
    });
    
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter usuário'
    });
  }
});

export default router;
