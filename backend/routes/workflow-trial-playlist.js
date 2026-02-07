
import express from 'express';
import { run, get, all } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// ========================================
// CONFIGURAÇÃO DO WORKFLOW
// ========================================

// GET /api/workflow/trial-playlist/config - Obter configuração
router.get('/config', (req, res) => {
  try {
    let config = get(
      'SELECT * FROM workflow_trial_playlist_config WHERE user_id = ?',
      [req.user.id]
    );
    
    // Se não existe, criar uma vazia
    if (!config) {
      run(`
        INSERT INTO workflow_trial_playlist_config (user_id) VALUES (?)
      `, [req.user.id]);
      
      config = get(
        'SELECT * FROM workflow_trial_playlist_config WHERE user_id = ?',
        [req.user.id]
      );
    }
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Erro ao obter config workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workflow/trial-playlist/config - Salvar configuração
router.put('/config', (req, res) => {
  try {
    const {
      koffice_account_id,
      sigma_account_id,
      uniplay_account_id,
      sigma_server_id,
      sigma_package_id,
      uniplay_hours,
      default_test_name
    } = req.body;
    
    // Verificar se existe
    const existing = get(
      'SELECT id FROM workflow_trial_playlist_config WHERE user_id = ?',
      [req.user.id]
    );
    
    if (existing) {
      run(`
        UPDATE workflow_trial_playlist_config SET
          koffice_account_id = ?,
          sigma_account_id = ?,
          uniplay_account_id = ?,
          sigma_server_id = ?,
          sigma_package_id = ?,
          uniplay_hours = ?,
          default_test_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [
        koffice_account_id || null,
        sigma_account_id || null,
        uniplay_account_id || null,
        sigma_server_id || null,
        sigma_package_id || null,
        uniplay_hours || 3,
        default_test_name || 'TESTE',
        req.user.id
      ]);
    } else {
      run(`
        INSERT INTO workflow_trial_playlist_config 
        (user_id, koffice_account_id, sigma_account_id, uniplay_account_id, sigma_server_id, sigma_package_id, uniplay_hours, default_test_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user.id,
        koffice_account_id || null,
        sigma_account_id || null,
        uniplay_account_id || null,
        sigma_server_id || null,
        sigma_package_id || null,
        uniplay_hours || 3,
        default_test_name || 'TESTE'
      ]);
    }
    
    const config = get(
      'SELECT * FROM workflow_trial_playlist_config WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ success: true, config, message: 'Configuração salva!' });
  } catch (error) {
    console.error('Erro ao salvar config workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
