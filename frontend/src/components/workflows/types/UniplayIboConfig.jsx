// components/workflows/types/UniplayIboConfig.jsx
// Configuração e formulário do workflow Uniplay + IBO

import { Zap } from 'lucide-react';

// Opções de tempo de teste (Uniplay suporta apenas 1h, 2h, 3h, 6h)
const TRIAL_DURATION_OPTIONS = [
  { value: 1, label: '1 hora' },
  { value: 2, label: '2 horas' },
  { value: 3, label: '3 horas' },
  { value: 6, label: '6 horas' }
];

// Componente de formulário
export function UniplayIboForm({ form, setForm, accounts, mode, extra }) {
  const { uniplay = [], ibo = [] } = accounts;
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Nome do Workflow</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Teste Uniplay → IBO"
          className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-amber-500 transition-fast"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Conta Uniplay</label>
        {uniplay.length === 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">Nenhuma conta Uniplay configurada</p>
          </div>
        ) : (
          <select
            value={form.uniplay_account_id || ''}
            onChange={(e) => setForm({ ...form, uniplay_account_id: e.target.value })}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-blue-500 transition-fast"
          >
            <option value="">Selecione uma conta</option>
            {uniplay.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.domain})</option>
            ))}
          </select>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Tempo de Teste Padrão</label>
        <select
          value={form.trial_hours || '3'}
          onChange={(e) => setForm({ ...form, trial_hours: e.target.value })}
          className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-blue-500 transition-fast"
        >
          {TRIAL_DURATION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-xs text-text-muted mt-1">Duração do teste que será gerado no Uniplay</p>
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
          <Zap size={16} className="text-blue-500" />
          O que este workflow faz:
        </h4>
        <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
          <li>Gera um teste na conta Uniplay com duração configurada</li>
          <li>Captura a URL M3U8 da playlist gerada</li>
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
  if (!form.uniplay_account_id) return 'Selecione a conta Uniplay';
  if (!form.trial_hours) return 'Selecione o tempo de teste';
  if (!form.ibo_account_id) return 'Selecione a conta IBO Revenda';
  return null;
}

// Montar config para salvar
export function buildConfig(form) {
  return {
    uniplay_account_id: parseInt(form.uniplay_account_id),
    ibo_account_id: parseInt(form.ibo_account_id),
    trial_hours: parseInt(form.trial_hours) || 3
  };
}

// Preencher form a partir de config existente
export function fillForm(config) {
  return {
    uniplay_account_id: config.uniplay_account_id?.toString() || '',
    ibo_account_id: config.ibo_account_id?.toString() || '',
    trial_hours: config.trial_hours?.toString() || '3'
  };
}

// Configuração exportada
export default {
  FormComponent: UniplayIboForm,
  validate,
  buildConfig,
  fillForm,
  description: 'Gera teste no Uniplay e cria cliente no IBO Revenda',
  icon: { color: 'blue', secondColor: 'emerald' },
  requiredAccounts: ['uniplay', 'ibo'],
  buttonColor: 'from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600'
};