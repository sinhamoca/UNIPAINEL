// pages/Dashboard.jsx
// Dashboard principal com Widgets e Workflows - VERSÃO COM WIDGETS

import { useState, useEffect } from 'react';
import { Plus, Zap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Componentes de Workflows
import WorkflowCard from '../components/workflows/WorkflowCard';
import WorkflowModal from '../components/workflows/WorkflowModal';
import ExecuteModal from '../components/workflows/ExecuteModal';

// Seção de Widgets
import WidgetsSection from '../components/widgets/WidgetsSection';

// Hook customizado
import useWorkflows from '../hooks/useWorkflows';

export default function Dashboard() {
  // Estado dos modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  
  // Hook de workflows
  const {
    workflows,
    loading,
    accounts,
    sigmaPackages,
    loadingPackages,
    loadWorkflows,
    loadAccounts,
    loadExtra,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    executeWorkflow,
    scanImage
  } = useWorkflows();
  
  // Carregar workflows ao montar
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);
  
  // Handlers
  const handleExecute = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowExecuteModal(true);
  };
  
  const handleEdit = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowEditModal(true);
  };
  
  const handleDelete = async (workflow) => {
    if (!confirm(`Excluir workflow "${workflow.name}"?`)) return;
    
    try {
      await deleteWorkflow(workflow.id);
      toast.success('Workflow excluído!');
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };
  
  const handleSave = async (data) => {
    if (data.id) {
      await updateWorkflow(data);
    } else {
      await createWorkflow(data);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ==================== SEÇÃO DE WIDGETS ==================== */}
        <WidgetsSection />
        
        {/* ==================== SEÇÃO DE WORKFLOWS ==================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">Workflows</h2>
              <p className="text-sm text-text-muted">Automações para criar testes e clientes</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
          >
            <Plus size={20} />
            Novo Workflow
          </button>
        </div>

        {/* Lista de Workflows */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16 bg-bg-card border border-border-color rounded-2xl">
            <div className="w-16 h-16 bg-bg-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap size={32} className="text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhum workflow ainda</h3>
            <p className="text-text-muted mb-6">Crie seu primeiro workflow para automatizar tarefas</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl"
            >
              Criar Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onExecute={handleExecute}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar */}
      {showCreateModal && (
        <WorkflowModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
          accounts={accounts}
          extra={{ sigmaPackages, loadingPackages }}
          loadAccounts={loadAccounts}
          loadExtra={loadExtra}
        />
      )}
      
      {/* Modal Editar */}
      {showEditModal && selectedWorkflow && (
        <WorkflowModal
          mode="edit"
          workflow={selectedWorkflow}
          onClose={() => { setShowEditModal(false); setSelectedWorkflow(null); }}
          onSave={handleSave}
          accounts={accounts}
          extra={{ sigmaPackages, loadingPackages }}
          loadAccounts={loadAccounts}
          loadExtra={loadExtra}
        />
      )}
      
      {/* Modal Executar */}
      {showExecuteModal && selectedWorkflow && (
        <ExecuteModal
          workflow={selectedWorkflow}
          onClose={() => { setShowExecuteModal(false); setSelectedWorkflow(null); }}
          onExecute={executeWorkflow}
          onScanImage={scanImage}
        />
      )}
    </div>
  );
}
