// components/workflows/types/KofficeIboConfig.jsx
// Configuração e formulário do workflow Koffice + IBO

import { Zap } from 'lucide-react';

// Componente de formulário
export function KofficeIboForm({ form, setForm, accounts, mode }) {
  const { koffice = [], ibo = [] } = accounts;
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Nome do Workflow</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Teste Koffice → IBO"
          className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-amber-500 transition-fast"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Conta Koffice</label>
        {koffice.length === 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">Nenhuma conta Koffice configurada</p>
          </div>
        ) : (
          <select
            value={form.koffice_account_id || ''}
            onChange={(e) => setForm({ ...form, koffice_account_id: e.target.value })}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-cyan-500 transition-fast"
          >
            <option value="">Selecione uma conta</option>
            {koffice.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.domain})</option>
            ))}
          </select>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Conta IBO Revenda</label>
        {ibo.length === 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">Nenhuma conta IBO configurada</p>
          </div>
        ) : (
          <select
            value={form.ibo_account_id || ''}
            onChange={(e) => setForm({ ...form, ibo_account_id: e.target.value })}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-emerald-500 transition-fast"
          >
            <option value="">Selecione uma conta</option>
            {ibo.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.email})</option>
            ))}
          </select>
        )}
      </div>
      
      <div className="bg-bg-tertiary border border-border-color rounded-xl p-4">
        <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          O que este workflow faz:
        </h4>
        <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
          <li>Gera um teste rápido na conta Koffice selecionada</li>
          <li>Obtém a URL M3U da playlist gerada</li>
          <li>Cria um novo cliente no IBO Revenda com essa playlist</li>
          <li>Define validade de 365 dias automaticamente</li>
        </ol>
      </div>
    </div>
  );
}

// Validação do formulário
export function validate(form) {
  if (!form.name?.trim()) return 'Informe um nome para o workflow';
  if (!form.koffice_account_id) return 'Selecione a conta Koffice';
  if (!form.ibo_account_id) return 'Selecione a conta IBO Revenda';
  return null;
}

// Montar config para salvar
export function buildConfig(form) {
  return {
    koffice_account_id: parseInt(form.koffice_account_id),
    ibo_account_id: parseInt(form.ibo_account_id)
  };
}

// Preencher form a partir de config existente
export function fillForm(config) {
  return {
    koffice_account_id: config.koffice_account_id?.toString() || '',
    ibo_account_id: config.ibo_account_id?.toString() || ''
  };
}

// Configuração exportada
export default {
  FormComponent: KofficeIboForm,
  validate,
  buildConfig,
  fillForm,
  description: 'Gera teste no Koffice e cria cliente no IBO Revenda',
  icon: { color: 'cyan', secondColor: 'emerald' },
  requiredAccounts: ['koffice', 'ibo'],
  buttonColor: 'from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600'
};
