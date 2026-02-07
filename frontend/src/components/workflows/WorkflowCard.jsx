// components/workflows/WorkflowCard.jsx
// Card individual de workflow - ATUALIZADO COM UNIPLAY

import { Play, Clock, Edit, Trash2, Server, Users, ArrowRight, Zap } from 'lucide-react';

export default function WorkflowCard({ workflow, onExecute, onEdit, onDelete }) {
  
  const getWorkflowIcon = (type) => {
    switch (type) {
      case 'koffice_ibo':
        return (
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 bg-cyan-500/20 rounded flex items-center justify-center">
              <Server size={14} className="text-cyan-500" />
            </div>
            <ArrowRight size={12} className="text-text-muted" />
            <div className="w-6 h-6 bg-emerald-500/20 rounded flex items-center justify-center">
              <Users size={14} className="text-emerald-500" />
            </div>
          </div>
        );
      case 'sigma_ibo':
        return (
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 bg-violet-500/20 rounded flex items-center justify-center">
              <Server size={14} className="text-violet-500" />
            </div>
            <ArrowRight size={12} className="text-text-muted" />
            <div className="w-6 h-6 bg-emerald-500/20 rounded flex items-center justify-center">
              <Users size={14} className="text-emerald-500" />
            </div>
          </div>
        );
      case 'uniplay_ibo':
        return (
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
              <Server size={14} className="text-blue-500" />
            </div>
            <ArrowRight size={12} className="text-text-muted" />
            <div className="w-6 h-6 bg-emerald-500/20 rounded flex items-center justify-center">
              <Users size={14} className="text-emerald-500" />
            </div>
          </div>
        );
      default:
        return <Zap size={20} className="text-amber-500" />;
    }
  };
  
  const getWorkflowColor = (type) => {
    switch (type) {
      case 'koffice_ibo': return 'from-cyan-500/20 to-emerald-500/20 border-cyan-500/30';
      case 'sigma_ibo': return 'from-violet-500/20 to-emerald-500/20 border-violet-500/30';
      case 'uniplay_ibo': return 'from-blue-500/20 to-emerald-500/20 border-blue-500/30';
      default: return 'from-amber-500/20 to-orange-500/20 border-amber-500/30';
    }
  };

  return (
    <div className={`bg-gradient-to-br ${getWorkflowColor(workflow.type)} border rounded-2xl p-5 hover:scale-[1.02] transition-all`}>
      {/* Header do Card */}
      <div className="flex items-start justify-between mb-4">
        {getWorkflowIcon(workflow.type)}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(workflow)}
            className="p-1.5 text-text-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-fast"
            title="Editar workflow"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(workflow)}
            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-fast"
            title="Excluir workflow"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* Info */}
      <h3 className="font-semibold text-lg text-text-primary mb-1">{workflow.name}</h3>
      <p className="text-sm text-text-muted mb-4">{workflow.description}</p>
      
      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
        <div className="flex items-center gap-1">
          <Play size={12} />
          <span>{workflow.use_count || 0} usos</span>
        </div>
        {workflow.last_used_at && (
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>Último: {new Date(workflow.last_used_at).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>
      
      {/* Botão Executar */}
      <button
        onClick={() => onExecute(workflow)}
        className="w-full py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur text-text-primary font-medium rounded-xl transition-fast flex items-center justify-center gap-2"
      >
        <Play size={16} />
        Executar
      </button>
    </div>
  );
}
