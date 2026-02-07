// hooks/useWorkflows.js
// Hook para gerenciar estado e operações de workflows
// ATUALIZADO COM SUPORTE A UNIPLAY

import { useState, useCallback } from 'react';
import { workflowAPI, playlistAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function useWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState({ koffice: [], ibo: [], sigma: [], uniplay: [] });
  const [sigmaPackages, setSigmaPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  
  // Carregar workflows
  const loadWorkflows = useCallback(async () => {
    try {
      const res = await workflowAPI.getWorkflows();
      setWorkflows(res.data.workflows || []);
    } catch (err) {
      toast.error('Erro ao carregar workflows');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Carregar contas baseado no tipo de workflow
  const loadAccounts = useCallback(async (type) => {
    try {
      const newAccounts = { ...accounts };
      
      if (type === 'koffice_ibo' || type.includes('koffice')) {
        const res = await workflowAPI.getKofficeAccounts();
        newAccounts.koffice = res.data.accounts || [];
      }
      
      if (type === 'sigma_ibo' || type.includes('sigma')) {
        const res = await workflowAPI.getSigmaAccounts();
        newAccounts.sigma = res.data.accounts || [];
      }
      
      // NOVO: Uniplay
      if (type === 'uniplay_ibo' || type.includes('uniplay')) {
        const res = await workflowAPI.getUniplayAccounts();
        newAccounts.uniplay = res.data.accounts || [];
      }
      
      // IBO é comum a todos
      const iboRes = await workflowAPI.getIboAccounts();
      newAccounts.ibo = iboRes.data.accounts || [];
      
      setAccounts(newAccounts);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    }
  }, [accounts]);
  
  // Carregar dados extras (ex: pacotes sigma)
  const loadExtra = useCallback(async (type, accountId) => {
    if (type === 'sigma' && accountId) {
      setLoadingPackages(true);
      try {
        const res = await workflowAPI.getSigmaPackages(accountId);
        setSigmaPackages(res.data.packages || []);
      } catch (err) {
        console.error('Erro ao carregar pacotes:', err);
        setSigmaPackages([]);
      } finally {
        setLoadingPackages(false);
      }
    }
  }, []);
  
  // Criar workflow
  const createWorkflow = useCallback(async (data) => {
    const res = await workflowAPI.createWorkflow(data);
    if (res.data.success) {
      await loadWorkflows();
    }
    return res.data;
  }, [loadWorkflows]);
  
  // Atualizar workflow
  const updateWorkflow = useCallback(async (data) => {
    const res = await workflowAPI.updateWorkflow(data.id, data);
    if (res.data.success) {
      await loadWorkflows();
    }
    return res.data;
  }, [loadWorkflows]);
  
  // Excluir workflow
  const deleteWorkflow = useCallback(async (id) => {
    const res = await workflowAPI.deleteWorkflow(id);
    if (res.data.success) {
      setWorkflows(prev => prev.filter(w => w.id !== id));
    }
    return res.data;
  }, []);
  
  // Executar workflow
  const executeWorkflow = useCallback(async (id, data) => {
    const res = await workflowAPI.executeWorkflow(id, data);
    if (res.data.success) {
      // Atualizar use_count localmente
      setWorkflows(prev => prev.map(w => 
        w.id === id ? { ...w, use_count: (w.use_count || 0) + 1, last_used_at: new Date().toISOString() } : w
      ));
    }
    return res.data.success ? res.data.result : null;
  }, []);
  
  // Scan de imagem
  const scanImage = useCallback(async (file) => {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const res = await playlistAPI.scanImage(base64);
    return res.data.mac;
  }, []);
  
  return {
    // Estado
    workflows,
    loading,
    accounts,
    sigmaPackages,
    loadingPackages,
    // Ações
    loadWorkflows,
    loadAccounts,
    loadExtra,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    executeWorkflow,
    scanImage
  };
}
