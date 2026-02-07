// components/workflows/WorkflowModal.jsx
// Modal unificado para criar/editar workflows

import { useState, useEffect } from 'react';
import { X, Loader2, Check, Zap, Server, Users, ArrowRight, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { WORKFLOW_TYPES, getWorkflowType } from './workflowRegistry';

export default function WorkflowModal({
  mode = 'create', // 'create' ou 'edit'
  workflow = null,
  onClose,
  onSave,
  accounts = {},
  extra = {},
  loadAccounts,
  loadExtra
}) {
  const [step, setStep] = useState(mode === 'edit' ? 2 : 1);
  const [workflowType, setWorkflowType] = useState(workflow?.type || '');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '' });
  
  // Preencher form quando editando
  useEffect(() => {
    if (mode === 'edit' && workflow) {
      const typeConfig = getWorkflowType(workflow.type);
      setWorkflowType(workflow.type);
      
      const filledForm = typeConfig?.fillForm?.(workflow.config) || {};
      setForm({ name: workflow.name, ...filledForm });
      
      // Carregar contas
      loadAccounts?.(workflow.type);
      
      // Carregar dados extras (ex: pacotes sigma)
      if (typeConfig?.needsExtra && workflow.config?.sigma_account_id) {
        loadExtra?.('sigma', workflow.config.sigma_account_id);
      }
    }
  }, [mode, workflow]);
  
  // Selecionar tipo e avançar
  const selectType = async (type) => {
    setWorkflowType(type);
    setForm({ name: '' });
    await loadAccounts?.(type);
    setStep(2);
  };
  
  // Salvar
  const handleSave = async () => {
    const typeConfig = getWorkflowType(workflowType);
    if (!typeConfig) return;
    
    const error = typeConfig.validate(form);
    if (error) {
      toast.error(error);
      return;
    }
    
    setSaving(true);
    try {
      const config = typeConfig.buildConfig(form);
      
      await onSave({
        id: workflow?.id,
        name: form.name,
        type: workflowType,
        description: typeConfig.description,
        config
      });
      
      toast.success(mode === 'create' ? 'Workflow criado!' : 'Workflow atualizado!');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };
  
  // Renderizar seletor de tipo
  const renderTypeSelector = () => (
    <div className="space-y-3">
      <p className="text-sm text-text-muted mb-4">Escolha o tipo de workflow:</p>
      
      {Object.entries(WORKFLOW_TYPES).map(([type, config]) => (
        <button
          key={type}
          onClick={() => selectType(type)}
          className="w-full p-4 bg-bg-tertiary hover:bg-bg-hover border border-border-color rounded-xl transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 bg-${config.icon.color}-500/20 rounded-lg flex items-center justify-center`}>
              <Server size={18} className={`text-${config.icon.color}-500`} />
            </div>
            <ArrowRight size={16} className="text-text-muted" />
            <div className={`w-8 h-8 bg-${config.icon.secondColor}-500/20 rounded-lg flex items-center justify-center`}>
              <Users size={18} className={`text-${config.icon.secondColor}-500`} />
            </div>
            <ChevronRight size={20} className="text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-semibold text-text-primary">{config.name}</h4>
          <p className="text-sm text-text-muted mt-1">{config.description}</p>
        </button>
      ))}
    </div>
  );
  
  // Renderizar formulário
  const renderForm = () => {
    const typeConfig = getWorkflowType(workflowType);
    if (!typeConfig) return null;
    
    const FormComponent = typeConfig.FormComponent;
    
    return (
      <FormComponent
        form={form}
        setForm={setForm}
        accounts={accounts}
        mode={mode}
        extra={{
          ...extra,
          onSigmaAccountChange: (accountId) => loadExtra?.('sigma', accountId)
        }}
      />
    );
  };
  
  const typeConfig = getWorkflowType(workflowType);
  const buttonColor = typeConfig?.buttonColor || 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-color sticky top-0 bg-bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{mode === 'create' ? 'Novo Workflow' : 'Editar Workflow'}</h3>
              {mode === 'create' && step === 1 && <p className="text-xs text-text-muted">Passo 1 de 2</p>}
              {mode === 'create' && step === 2 && <p className="text-xs text-text-muted">Passo 2 de 2</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === 1 && renderTypeSelector()}
          
          {step === 2 && (
            <>
              {renderForm()}
              
              <div className="flex gap-3 pt-4 mt-4 border-t border-border-color">
                <button
                  onClick={() => mode === 'create' ? setStep(1) : onClose()}
                  className="flex-1 h-11 bg-bg-tertiary hover:bg-bg-hover text-text-primary font-semibold rounded-xl transition-fast"
                >
                  {mode === 'create' ? 'Voltar' : 'Cancelar'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 h-11 bg-gradient-to-r ${buttonColor} text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check size={18} /> {mode === 'create' ? 'Criar' : 'Salvar'}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
