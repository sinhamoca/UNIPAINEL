// components/workflows/workflowRegistry.js
// Registry central de tipos de workflow - ATUALIZADO COM UNIPLAY

import KofficeIboConfig from './types/KofficeIboConfig';
import SigmaIboConfig from './types/SigmaIboConfig';
import UniplayIboConfig from './types/UniplayIboConfig';

export const WORKFLOW_TYPES = {
  koffice_ibo: {
    name: 'Koffice + IBO Revenda',
    description: 'Gera teste no Koffice e cria cliente no IBO Revenda automaticamente',
    ...KofficeIboConfig
  },
  sigma_ibo: {
    name: 'Sigma + IBO Revenda', 
    description: 'Gera teste no Sigma e cria cliente no IBO Revenda automaticamente',
    ...SigmaIboConfig
  },
  uniplay_ibo: {
    name: 'Uniplay + IBO Revenda',
    description: 'Gera teste no Uniplay e cria cliente no IBO Revenda automaticamente',
    ...UniplayIboConfig
  }
  // ADICIONE NOVOS TIPOS AQUI
};

// Helpers
export const getWorkflowType = (type) => WORKFLOW_TYPES[type];
export const getWorkflowTypes = () => Object.entries(WORKFLOW_TYPES);
export const isValidWorkflowType = (type) => type in WORKFLOW_TYPES;
