// routes/playlist.js - Rotas do Playlist Manager
import express from 'express';
import { run, get, all } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import * as sessionManager from '../services/playlist-session.js';
import imageScanner from '../services/image-scanner.js';

const router = express.Router();

// Todos os endpoints precisam de autenticação
router.use(authenticateToken);

// Serviços por tipo de player (lazy loading)
const playerServices = {
  iboplayer: async () => (await import('../services/playlist-iboplayer.js')).default,
  ibopro: async () => (await import('../services/playlist-ibopro.js')).default,
  vuplayer: async () => (await import('../services/playlist-vuplayer.js')).default
};

// ========================================
// OCR - EXTRAÇÃO DE MAC E DEVICE KEY
// ========================================

// POST /api/playlist/scan-image - Escanear imagem para extrair MAC e Device Key
router.post('/scan-image', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ success: false, error: 'Imagem é obrigatória' });
    }
    
    console.log('📸 Recebendo imagem para OCR...');
    
    const result = await imageScanner.scanImageBase64(image);
    
    if (result.error) {
      return res.status(400).json({ 
        success: false, 
        error: result.error,
        mac: null,
        key: null
      });
    }
    
    res.json({
      success: true,
      mac: result.mac,
      key: result.key,
      raw: result.raw
    });
    
  } catch (error) {
    console.error('Erro no OCR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// DOMÍNIOS PRÉ-CADASTRADOS
// ========================================

// GET /api/playlist/domains - Listar domínios
router.get('/domains', (req, res) => {
  try {
    const domains = all(`
      SELECT * FROM playlist_domains 
      WHERE user_id = ? AND is_active = 1
      ORDER BY domain ASC
    `, [req.user.id]);
    
    res.json({ success: true, domains });
  } catch (error) {
    console.error('Erro ao listar domínios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/domains - Criar domínio
router.post('/domains', (req, res) => {
  try {
    const { domain, description } = req.body;
    
    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domínio é obrigatório' });
    }
    
    // Limpar domínio
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    
    // Verificar se já existe
    const existing = get(`
      SELECT id FROM playlist_domains 
      WHERE user_id = ? AND domain = ?
    `, [req.user.id, cleanDomain]);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Domínio já cadastrado' });
    }
    
    run(`
      INSERT INTO playlist_domains (user_id, domain, description)
      VALUES (?, ?, ?)
    `, [req.user.id, cleanDomain, description || null]);
    
    // Buscar o domínio recém criado
    const newDomain = get(`
      SELECT * FROM playlist_domains 
      WHERE user_id = ? AND domain = ?
    `, [req.user.id, cleanDomain]);
    
    res.json({ 
      success: true, 
      domain: newDomain || { domain: cleanDomain, description }
    });
  } catch (error) {
    console.error('Erro ao criar domínio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/playlist/domains/:id - Deletar domínio
router.delete('/domains/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    run(`
      DELETE FROM playlist_domains 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar domínio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CLIENTES (DISPOSITIVOS)
// ========================================

// GET /api/playlist/clients - Listar clientes
router.get('/clients', (req, res) => {
  try {
    const clients = all(`
      SELECT 
        c.id, c.name, c.player_type, c.mac_address, c.device_key, c.password, c.domain, c.notes,
        c.server_id, c.has_active_session, c.last_used_at, c.created_at,
        s.name as server_name, s.color as server_color
      FROM playlist_clients c
      LEFT JOIN playlist_servers s ON c.server_id = s.id
      WHERE c.user_id = ? AND c.is_active = 1
      ORDER BY c.last_used_at DESC NULLS LAST, c.created_at DESC
    `, [req.user.id]);
    
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/playlist/clients/search - Buscar clientes
router.get('/clients/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, clients: [] });
    }
    
    const searchTerm = `%${q}%`;
    const clients = all(`
      SELECT 
        id, name, player_type, mac_address, domain, notes,
        has_active_session, last_used_at, created_at
      FROM playlist_clients 
      WHERE user_id = ? AND is_active = 1
        AND (name LIKE ? OR mac_address LIKE ?)
      ORDER BY last_used_at DESC NULLS LAST
      LIMIT 20
    `, [req.user.id, searchTerm, searchTerm]);
    
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/playlist/clients/:id - Obter cliente
router.get('/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    res.json({ success: true, client });
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/clients - Criar cliente
router.post('/clients', (req, res) => {
  try {
    const { name, player_type, mac_address, device_key, password, domain, notes, server_id } = req.body;
    
    if (!name || !player_type || !mac_address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome, tipo de player e MAC são obrigatórios' 
      });
    }
    
    // Validar tipo de player
    if (!['iboplayer', 'ibopro', 'vuplayer'].includes(player_type)) {
      return res.status(400).json({ success: false, error: 'Tipo de player inválido' });
    }
    
    // IBOPlayer precisa de device_key e domain
    if (player_type === 'iboplayer' && (!device_key || !domain)) {
      return res.status(400).json({ 
        success: false, 
        error: 'IBOPlayer requer Device Key e Domínio' 
      });
    }
    
    // IBOPro precisa de password
    if (player_type === 'ibopro' && !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'IBOPro requer senha' 
      });
    }
    
    // VUPlayer precisa de device_key
    if (player_type === 'vuplayer' && !device_key) {
      return res.status(400).json({ 
        success: false, 
        error: 'VUPlayer requer Device Key' 
      });
    }
    
    // Verificar se MAC já existe
    const existing = get(`
      SELECT id FROM playlist_clients 
      WHERE user_id = ? AND mac_address = ?
    `, [req.user.id, mac_address]);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'MAC Address já cadastrado' });
    }
    
    // Validar server_id se fornecido
    if (server_id) {
      const server = get(`
        SELECT id FROM playlist_servers 
        WHERE id = ? AND user_id = ?
      `, [server_id, req.user.id]);
      
      if (!server) {
        return res.status(400).json({ success: false, error: 'Servidor não encontrado' });
      }
    }
    
    // Limpar domínio se fornecido
    const cleanDomain = domain ? domain.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
    
    run(`
      INSERT INTO playlist_clients (user_id, server_id, name, player_type, mac_address, device_key, password, domain, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, server_id || null, name, player_type, mac_address, device_key || null, password || null, cleanDomain, notes || null]);
    
    // Buscar o cliente recém criado
    const newClient = get(`
      SELECT * FROM playlist_clients 
      WHERE user_id = ? AND mac_address = ?
    `, [req.user.id, mac_address]);
    
    if (newClient) {
      sessionManager.logAction(req.user.id, newClient.id, 'create_client', `Cliente "${name}" criado`);
    }
    
    res.json({ 
      success: true, 
      client: newClient || { name, player_type, mac_address, domain: cleanDomain }
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/playlist/clients/:id - Atualizar cliente
router.put('/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, mac_address, device_key, password, domain, notes, server_id } = req.body;
    
    // Verificar se cliente existe
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    // Validar server_id se fornecido
    if (server_id !== undefined && server_id !== null && server_id !== '') {
      const server = get(`
        SELECT id FROM playlist_servers 
        WHERE id = ? AND user_id = ?
      `, [server_id, req.user.id]);
      
      if (!server) {
        return res.status(400).json({ success: false, error: 'Servidor não encontrado' });
      }
    }
    
    // Limpar domínio se fornecido
    const cleanDomain = domain ? domain.replace(/^https?:\/\//, '').replace(/\/$/, '') : client.domain;
    
    // Determinar server_id final
    const finalServerId = server_id === '' ? null : (server_id !== undefined ? server_id : client.server_id);
    
    run(`
      UPDATE playlist_clients 
      SET name = ?, mac_address = ?, device_key = ?, password = ?, domain = ?, notes = ?, server_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [
      name || client.name,
      mac_address || client.mac_address,
      device_key !== undefined ? device_key : client.device_key,
      password !== undefined ? password : client.password,
      cleanDomain,
      notes !== undefined ? notes : client.notes,
      finalServerId,
      id,
      req.user.id
    ]);
    
    // Se mudou credenciais, invalidar sessão
    if (mac_address || device_key || password || domain) {
      sessionManager.deleteSession(id);
    }
    
    sessionManager.logAction(req.user.id, id, 'update_client', `Cliente atualizado`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/playlist/clients/:id - Deletar cliente
router.delete('/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const client = get(`
      SELECT name FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    // Deletar sessão
    sessionManager.deleteSession(id);
    
    // Deletar cliente (soft delete)
    run(`
      UPDATE playlist_clients 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    sessionManager.logAction(req.user.id, id, 'delete_client', `Cliente "${client.name}" deletado`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// PLAYLISTS (AÇÕES NO PLAYER)
// ========================================

// GET /api/playlist/clients/:id/playlists - Listar playlists do cliente
router.get('/clients/:id/playlists', async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    // Obter serviço do player
    const getService = playerServices[client.player_type];
    if (!getService) {
      return res.status(400).json({ success: false, error: 'Tipo de player não suportado' });
    }
    
    const service = await getService();
    
    // Obter sessão válida
    const session = await sessionManager.getValidSession(client, service.login);
    
    // Listar playlists
    const playlists = await service.listPlaylists(session.sessionData);
    
    res.json({ success: true, playlists });
  } catch (error) {
    console.error('Erro ao listar playlists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/clients/:id/playlists - Adicionar playlist
router.post('/clients/:id/playlists', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, type = 'general', protect = false, pin = '' } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'Nome e URL são obrigatórios' });
    }
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    const getService = playerServices[client.player_type];
    if (!getService) {
      return res.status(400).json({ success: false, error: 'Tipo de player não suportado' });
    }
    
    const service = await getService();
    const session = await sessionManager.getValidSession(client, service.login);
    
    const result = await service.addPlaylist(session.sessionData, { name, url, type, protect, pin });
    
    sessionManager.logAction(req.user.id, id, 'add_playlist', `Playlist "${name}" adicionada`);
    
    res.json({ success: true, playlist: result });
  } catch (error) {
    console.error('Erro ao adicionar playlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/playlist/clients/:id/playlists/:playlistId - Editar playlist
router.put('/clients/:id/playlists/:playlistId', async (req, res) => {
  try {
    const { id, playlistId } = req.params;
    const { name, url, type = 'general', protect = false, pin = '' } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'Nome e URL são obrigatórios' });
    }
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    const getService = playerServices[client.player_type];
    if (!getService) {
      return res.status(400).json({ success: false, error: 'Tipo de player não suportado' });
    }
    
    const service = await getService();
    const session = await sessionManager.getValidSession(client, service.login);
    
    const result = await service.editPlaylist(session.sessionData, playlistId, { name, url, type, protect, pin });
    
    sessionManager.logAction(req.user.id, id, 'edit_playlist', `Playlist "${name}" editada`);
    
    res.json({ success: true, playlist: result });
  } catch (error) {
    console.error('Erro ao editar playlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/playlist/clients/:id/playlists/:playlistId - Deletar playlist
router.delete('/clients/:id/playlists/:playlistId', async (req, res) => {
  try {
    const { id, playlistId } = req.params;
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    const getService = playerServices[client.player_type];
    if (!getService) {
      return res.status(400).json({ success: false, error: 'Tipo de player não suportado' });
    }
    
    const service = await getService();
    const session = await sessionManager.getValidSession(client, service.login);
    
    await service.deletePlaylist(session.sessionData, playlistId);
    
    sessionManager.logAction(req.user.id, id, 'delete_playlist', `Playlist deletada`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar playlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/clients/:id/playlists/:playlistId/change-domain - Trocar domínio
router.post('/clients/:id/playlists/:playlistId/change-domain', async (req, res) => {
  try {
    const { id, playlistId } = req.params;
    const { newDomain } = req.body;
    
    if (!newDomain) {
      return res.status(400).json({ success: false, error: 'Novo domínio é obrigatório' });
    }
    
    const client = get(`
      SELECT * FROM playlist_clients 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    const getService = playerServices[client.player_type];
    if (!getService) {
      return res.status(400).json({ success: false, error: 'Tipo de player não suportado' });
    }
    
    const service = await getService();
    const session = await sessionManager.getValidSession(client, service.login);
    
    // Obter playlist atual
    const playlists = await service.listPlaylists(session.sessionData);
    const playlist = playlists.find(p => p.id === playlistId);
    
    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist não encontrada' });
    }
    
    // Trocar domínio na URL
    const oldUrl = playlist.url;
    const urlMatch = oldUrl.match(/^(https?:\/\/)?([^\/\?]+)/);
    const oldDomain = urlMatch ? urlMatch[2] : null;
    
    if (!oldDomain) {
      return res.status(400).json({ success: false, error: 'Não foi possível extrair o domínio da URL' });
    }
    
    const protocolMatch = oldUrl.match(/^(https?):\/\//);
    const protocol = protocolMatch ? protocolMatch[1] : 'http';
    
    const newUrl = oldUrl.replace(
      new RegExp(`^https?:\/\/${oldDomain.replace(/\./g, '\\.')}`, 'i'),
      `${protocol}://${newDomain}`
    );
    
    // Editar playlist com nova URL
    await service.editPlaylist(session.sessionData, playlistId, {
      name: playlist.name,
      url: newUrl,
      protect: playlist.is_protected,
      pin: '',
      type: playlist.type || 'general'
    });
    
    sessionManager.logAction(req.user.id, id, 'change_domain', `${oldDomain} → ${newDomain}`);
    
    res.json({ 
      success: true, 
      oldDomain, 
      newDomain,
      oldUrl,
      newUrl
    });
  } catch (error) {
    console.error('Erro ao trocar domínio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ESTATÍSTICAS E LOGS
// ========================================

// GET /api/playlist/stats - Estatísticas
router.get('/stats', (req, res) => {
  try {
    const totalClients = get(`
      SELECT COUNT(*) as count FROM playlist_clients 
      WHERE user_id = ? AND is_active = 1
    `, [req.user.id]).count;
    
    const activeSessions = get(`
      SELECT COUNT(*) as count FROM playlist_clients 
      WHERE user_id = ? AND is_active = 1 AND has_active_session = 1
    `, [req.user.id]).count;
    
    const byPlayer = all(`
      SELECT player_type, COUNT(*) as count 
      FROM playlist_clients 
      WHERE user_id = ? AND is_active = 1
      GROUP BY player_type
    `, [req.user.id]);
    
    const recentActivity = get(`
      SELECT COUNT(*) as count 
      FROM playlist_logs 
      WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')
    `, [req.user.id]).count;
    
    const sessionStats = sessionManager.getSessionStats();
    
    res.json({ 
      success: true, 
      stats: {
        totalClients,
        activeSessions,
        byPlayer,
        recentActivity,
        ...sessionStats
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/playlist/logs - Últimas atividades
router.get('/logs', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const logs = all(`
      SELECT l.*, c.name as client_name
      FROM playlist_logs l
      LEFT JOIN playlist_clients c ON l.client_id = c.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
      LIMIT ?
    `, [req.user.id, parseInt(limit)]);
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Erro ao obter logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/clean-sessions - Limpar sessões expiradas
router.post('/clean-sessions', async (req, res) => {
  try {
    const cleaned = await sessionManager.cleanExpiredSessions();
    res.json({ success: true, cleaned });
  } catch (error) {
    console.error('Erro ao limpar sessões:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// SERVIDORES (TAGS/GRUPOS)
// ========================================

// GET /api/playlist/servers - Listar servidores
router.get('/servers', (req, res) => {
  try {
    const servers = all(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM playlist_clients c WHERE c.server_id = s.id AND c.is_active = 1) as client_count
      FROM playlist_servers s
      WHERE s.user_id = ? AND s.is_active = 1
      ORDER BY s.name ASC
    `, [req.user.id]);
    
    res.json({ success: true, servers });
  } catch (error) {
    console.error('Erro ao listar servidores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/playlist/servers - Criar servidor
router.post('/servers', (req, res) => {
  try {
    const { name, color, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }
    
    // Verificar se já existe
    const existing = get(`
      SELECT id FROM playlist_servers 
      WHERE user_id = ? AND name = ?
    `, [req.user.id, name]);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Servidor já existe com este nome' });
    }
    
    run(`
      INSERT INTO playlist_servers (user_id, name, color, description)
      VALUES (?, ?, ?, ?)
    `, [req.user.id, name, color || '🔵', description || null]);
    
    const newServer = get(`
      SELECT * FROM playlist_servers 
      WHERE user_id = ? AND name = ?
    `, [req.user.id, name]);
    
    res.json({ success: true, server: newServer });
  } catch (error) {
    console.error('Erro ao criar servidor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/playlist/servers/:id - Atualizar servidor
router.put('/servers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    
    const server = get(`
      SELECT * FROM playlist_servers 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Servidor não encontrado' });
    }
    
    run(`
      UPDATE playlist_servers 
      SET name = ?, color = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [
      name || server.name,
      color || server.color,
      description !== undefined ? description : server.description,
      id,
      req.user.id
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar servidor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/playlist/servers/:id - Deletar servidor
router.delete('/servers/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const server = get(`
      SELECT name FROM playlist_servers 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.id]);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Servidor não encontrado' });
    }
    
    // Remover referência dos clientes
    run(`UPDATE playlist_clients SET server_id = NULL WHERE server_id = ?`, [id]);
    
    // Deletar servidor (soft delete)
    run(`UPDATE playlist_servers SET is_active = 0 WHERE id = ?`, [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar servidor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// TROCA DE DNS EM MASSA
// ========================================

// POST /api/playlist/bulk-dns - Trocar DNS em massa
router.post('/bulk-dns', async (req, res) => {
  try {
    const { client_ids, server_id, mode, old_domain, new_domain } = req.body;
    
    if (!new_domain) {
      return res.status(400).json({ success: false, error: 'Novo domínio é obrigatório' });
    }
    
    if (!mode || !['all', 'first', 'specific'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Modo inválido' });
    }
    
    if (mode === 'specific' && !old_domain) {
      return res.status(400).json({ success: false, error: 'Domínio antigo é obrigatório para modo específico' });
    }
    
    // Buscar clientes
    let clients = [];
    
    if (client_ids && client_ids.length > 0) {
      // Seleção manual
      const placeholders = client_ids.map(() => '?').join(',');
      clients = all(`
        SELECT * FROM playlist_clients 
        WHERE id IN (${placeholders}) AND user_id = ? AND is_active = 1
      `, [...client_ids, req.user.id]);
    } else if (server_id) {
      // Por servidor
      clients = all(`
        SELECT * FROM playlist_clients 
        WHERE server_id = ? AND user_id = ? AND is_active = 1
      `, [server_id, req.user.id]);
    } else {
      return res.status(400).json({ success: false, error: 'Selecione clientes ou um servidor' });
    }
    
    if (clients.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum cliente encontrado' });
    }
    
    // Limpar novo domínio
    const cleanNewDomain = new_domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const cleanOldDomain = old_domain ? old_domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() : null;
    
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      playlistsChanged: 0,
      errors: []
    };
    
    // Processar cada cliente
    for (const client of clients) {
      try {
        // Obter serviço do player
        const getService = playerServices[client.player_type];
        if (!getService) {
          results.failed++;
          results.errors.push(`${client.name}: Player não suportado`);
          continue;
        }
        
        const service = await getService();
        
        // Obter sessão válida
        const session = await sessionManager.getValidSession(client, service.login);
        
        // Listar playlists
        const playlists = await service.listPlaylists(session.sessionData);
        
        if (!playlists || playlists.length === 0) {
          results.skipped++;
          continue;
        }
        
        // Filtrar playlists conforme o modo
        let playlistsToProcess = [];
        
        switch (mode) {
          case 'all':
            playlistsToProcess = playlists;
            break;
          case 'first':
            playlistsToProcess = [playlists[0]];
            break;
          case 'specific':
            playlistsToProcess = playlists.filter(p => {
              const urlMatch = p.url.match(/^(https?:\/\/)?([^\/\?]+)/);
              const playlistDomain = urlMatch ? urlMatch[2].toLowerCase() : null;
              return playlistDomain && playlistDomain.includes(cleanOldDomain);
            });
            break;
        }
        
        if (playlistsToProcess.length === 0) {
          results.skipped++;
          continue;
        }
        
        let clientChanged = false;
        
        for (const playlist of playlistsToProcess) {
          try {
            const oldUrl = playlist.url;
            const urlMatch = oldUrl.match(/^(https?:\/\/)?([^\/\?]+)/);
            const currentDomain = urlMatch ? urlMatch[2] : null;
            
            if (!currentDomain) continue;
            
            // Detectar protocolo
            const protocolMatch = oldUrl.match(/^(https?):\/\//);
            const protocol = protocolMatch ? protocolMatch[1] : 'http';
            
            // Construir nova URL
            const newUrl = oldUrl.replace(
              new RegExp(`^https?:\/\/${currentDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
              `${protocol}://${cleanNewDomain}`
            );
            
            if (newUrl !== oldUrl) {
              await service.editPlaylist(session.sessionData, playlist.id, {
                name: playlist.name,
                url: newUrl,
                protect: playlist.is_protected,
                pin: playlist.pin || '',
                type: playlist.type || 'general'
              });
              
              results.playlistsChanged++;
              clientChanged = true;
            }
          } catch (playlistError) {
            console.error(`Erro na playlist ${playlist.name}:`, playlistError.message);
          }
        }
        
        if (clientChanged) {
          results.success++;
          sessionManager.logAction(req.user.id, client.id, 'bulk_dns_change', `DNS alterado para ${cleanNewDomain}`);
        } else {
          results.skipped++;
        }
        
      } catch (clientError) {
        console.error(`Erro no cliente ${client.name}:`, clientError.message);
        results.failed++;
        results.errors.push(`${client.name}: ${clientError.message}`);
      }
    }
    
    res.json({
      success: true,
      results: {
        total: clients.length,
        ...results
      }
    });
    
  } catch (error) {
    console.error('Erro na troca de DNS em massa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
