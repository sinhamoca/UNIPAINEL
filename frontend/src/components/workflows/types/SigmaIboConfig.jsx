// components/workflows/types/SigmaIboConfig.jsx
// Configuração e formulário do workflow Sigma + IBO

import { Loader2, Zap } from 'lucide-react';

// Componente de formulário
export function SigmaIboForm({ form, setForm, accounts, mode, extra = {} }) {
  const { sigma = [], ibo = [] } = accounts;
  const { sigmaPackages = [], loadingPackages = false, onSigmaAccountChange } = extra;
  
  const handleSigmaChange = (accountId) => {
    setForm({ 
      ...form, 
      sigma_account_id: accountId, 
      default_package_id: '', 
      default_server_id: '' 
    });
    if (onSigmaAccountChange) {
      onSigmaAccountChange(accountId);
    }
  };
  
  const handlePackageChange = (value) => {
    if (!value) {
      setForm({ ...form, default_package_id: '', default_server_id: '' });
      return;
    }
    const [serverId, packageId] = value.split('|');
    setForm({ ...form, default_server_id: serverId, default_package_id: packageId });
  };
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Nome do Workflow</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Teste Sigma → IBO"
          className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-amber-500 transition-fast"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Conta Sigma</label>
        {sigma.length === 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">Nenhuma conta Sigma configurada</p>
          </div>
        ) : (
          <select
            value={form.sigma_account_id || ''}
            onChange={(e) => handleSigmaChange(e.target.value)}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-violet-500 transition-fast"
          >
            <option value="">Selecione uma conta</option>
            {sigma.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.domain})</option>
            ))}
          </select>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Pacote Padrão (Trial)
          {loadingPackages && <Loader2 size={14} className="inline ml-2 animate-spin" />}
        </label>
        {!form.sigma_account_id ? (
          <div className="p-3 bg-bg-tertiary border border-border-color rounded-xl">
            <p className="text-sm text-text-muted">Selecione uma conta Sigma primeiro</p>
          </div>
        ) : sigmaPackages.length === 0 && !loadingPackages ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">Nenhum pacote trial disponível</p>
          </div>
        ) : (
          <select
            value={form.default_package_id ? `${form.default_server_id}|${form.default_package_id}` : ''}
            onChange={(e) => handlePackageChange(e.target.value)}
            disabled={loadingPackages}
            className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-violet-500 transition-fast disabled:opacity-50"
          >
            <option value="">Selecione um pacote</option>
            {sigmaPackages.map(pkg => (
              <option key={`${pkg.server_id}|${pkg.id}`} value={`${pkg.server_id}|${pkg.id}`}>
                {pkg.name} ({pkg.server_name}) - {pkg.trial_hours || pkg.duration}h
              </option>
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
          <Zap size={16} className="text-violet-500" />
          O que este workflow faz:
        </h4>
        <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
          <li>Gera um teste trial na conta Sigma com o pacote selecionado</li>
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
  if (!form.sigma_account_id) return 'Selecione a conta Sigma';
  if (!form.default_package_id || !form.default_server_id) return 'Selecione o pacote padrão';
  if (!form.ibo_account_id) return 'Selecione a conta IBO Revenda';
  return null;
}

// Montar config para salvar (IDs são strings no Sigma!)
export function buildConfig(form) {
  return {
    sigma_account_id: parseInt(form.sigma_account_id),
    ibo_account_id: parseInt(form.ibo_account_id),
    default_package_id: form.default_package_id, // String!
    default_server_id: form.default_server_id    // String!
  };
}

// Preencher form a partir de config existente
export function fillForm(config) {
  return {
    sigma_account_id: config.sigma_account_id?.toString() || '',
    ibo_account_id: config.ibo_account_id?.toString() || '',
    default_package_id: config.default_package_id || '',
    default_server_id: config.default_server_id || ''
  };
}

// Configuração exportada
export default {
  FormComponent: SigmaIboForm,
  validate,
  buildConfig,
  fillForm,
  description: 'Gera teste no Sigma e cria cliente no IBO Revenda',
  icon: { color: 'violet', secondColor: 'emerald' },
  requiredAccounts: ['sigma', 'ibo'],
  buttonColor: 'from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600',
  // Indica que precisa de dados extras (pacotes)
  needsExtra: true,
  extraKey: 'sigma' // para identificar qual conta precisa carregar dados extras
};
