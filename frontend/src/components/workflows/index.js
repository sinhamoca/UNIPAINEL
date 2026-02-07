// components/workflows/index.js
// Exportações centralizadas

export { default as WorkflowCard } from './WorkflowCard';
export { default as WorkflowModal } from './WorkflowModal';
export { default as ExecuteModal } from './ExecuteModal';
export { WORKFLOW_TYPES, getWorkflowType, getWorkflowTypes } from './workflowRegistry';

// Para criar um novo tipo de workflow:
// 1. Crie um arquivo em ./types/NomeDoWorkflowConfig.jsx
// 2. Exporte: FormComponent, validate, buildConfig, fillForm, description, icon, requiredAccounts
// 3. Adicione no workflowRegistry.js
