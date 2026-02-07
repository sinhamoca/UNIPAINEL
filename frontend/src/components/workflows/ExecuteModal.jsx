// components/workflows/ExecuteModal.jsx
// Modal para executar workflows - ATUALIZADO COM UNIPLAY

import { useState } from 'react';
import { X, Loader2, Play, Camera, Plus, Check, Server, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExecuteModal({ 
  workflow, 
  onClose, 
  onExecute,
  onScanImage 
}) {
  const [form, setForm] = useState({ name: '', mac_address: '' });
  const [result, setResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // Scan de imagem para extrair MAC
  const handleScan = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }
    
    setScanning(true);
    try {
      const mac = await onScanImage(file);
      if (mac) {
        // Formatar MAC
        const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const formatted = cleaned.length === 12 ? cleaned.match(/.{2}/g).join(':') : mac;
        setForm(prev => ({ ...prev, mac_address: formatted }));
        toast.success('📱 MAC extraído!');
      } else {
        toast.error('Não foi possível extrair MAC');
      }
    } catch (err) {
      toast.error('Erro ao escanear');
    } finally {
      setScanning(false);
    }
  };
  
  // Executar workflow
  const handleExecute = async () => {
    if (!form.name?.trim() || !form.mac_address?.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    setExecuting(true);
    try {
      const res = await onExecute(workflow.id, form);
      if (res) {
        setResult(res);
        toast.success('Workflow executado!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao executar');
    } finally {
      setExecuting(false);
    }
  };
  
  // Formatar MAC enquanto digita
  const handleMacChange = (value) => {
    let cleaned = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (cleaned.length > 12) cleaned = cleaned.slice(0, 12);
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    setForm(prev => ({ ...prev, mac_address: formatted }));
  };
  
  // Determinar tipo e dados
  const isSigma = workflow.type === 'sigma_ibo';
  const isUniplay = workflow.type === 'uniplay_ibo';
  const isKoffice = workflow.type === 'koffice_ibo';
  
  // Pegar dados do teste baseado no tipo
  const getTestData = () => {
    if (!result) return null;
    if (isSigma) return result.sigma_test;
    if (isUniplay) return result.uniplay_test;
    if (isKoffice) return result.koffice_test;
    return null;
  };
  
  const testData = getTestData();
  
  // Cor do ícone baseado no tipo
  const getIconColor = () => {
    if (isSigma) return 'text-violet-500';
    if (isUniplay) return 'text-blue-500';
    return 'text-cyan-500';
  };
  
  // Nome do serviço
  const getServiceName = () => {
    if (isSigma) return 'Teste Sigma';
    if (isUniplay) return 'Teste Uniplay';
    return 'Teste Koffice';
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-color sticky top-0 bg-bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Server size={16} className={getIconColor()} />
              <span className="text-text-muted">→</span>
              <Users size={16} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold">{workflow.name}</h3>
              <p className="text-xs text-text-muted">Executar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {result ? (
            /* Resultado */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={20} className="text-emerald-500" />
                  <span className="font-semibold text-emerald-400">Sucesso!</span>
                </div>
                <p className="text-sm text-text-secondary">{result.message}</p>
              </div>
              
              {/* Dados do teste */}
              <div className="bg-bg-tertiary rounded-xl p-4">
                <h4 className={`font-medium mb-2 flex items-center gap-2 ${getIconColor().replace('text-', 'text-')}`}>
                  <Server size={16} />
                  {getServiceName()}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Usuário:</span>
                    <p className="font-mono text-text-primary">{testData?.username || testData?.user}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Senha:</span>
                    <p className="font-mono text-text-primary">{testData?.password}</p>
                  </div>
                  {testData?.validUntil && (
                    <div className="col-span-2">
                      <span className="text-text-muted">Válido até:</span>
                      <p className="text-text-primary">{testData.validUntil}</p>
                    </div>
                  )}
                </div>
                {testData?.m3uUrl && (
                  <div className="mt-2">
                    <span className="text-text-muted text-sm">M3U8:</span>
                    <p className="font-mono text-xs text-cyan-400 break-all">{testData.m3uUrl}</p>
                  </div>
                )}
                {testData?.shortUrl && (
                  <div className="mt-2">
                    <span className="text-text-muted text-sm">Link Curto:</span>
                    <p className="font-mono text-xs text-amber-400 break-all">{testData.shortUrl}</p>
                  </div>
                )}
              </div>
              
              {/* Dados IBO */}
              <div className="bg-bg-tertiary rounded-xl p-4">
                <h4 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
                  <Users size={16} />
                  Cliente IBO Revenda
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Nome:</span>
                    <p className="text-text-primary">{result.ibo_client?.name}</p>
                  </div>
                  <div>
                    <span className="text-text-muted">Validade:</span>
                    <p className="text-text-primary">{result.ibo_client?.expire_date}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-muted">MAC:</span>
                    <p className="font-mono text-text-primary">{result.ibo_client?.mac_address}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setResult(null); setForm({ name: '', mac_address: '' }); }}
                  className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Criar Outro
                </button>
                <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary text-text-primary font-semibold rounded-xl">
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            /* Formulário */
            <div className="space-y-4">
              {/* OCR */}
              <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-xl cursor-pointer transition-all ${scanning ? 'opacity-70' : 'hover:from-cyan-600 hover:to-emerald-600'}`}>
                {scanning ? (
                  <><Loader2 size={18} className="animate-spin" /> Escaneando...</>
                ) : (
                  <><Camera size={18} /> Escanear MAC por Foto</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={scanning}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleScan(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Nome do Usuário</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-amber-500 transition-fast"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">MAC Address</label>
                <input
                  type="text"
                  value={form.mac_address}
                  onChange={(e) => handleMacChange(e.target.value)}
                  placeholder="00:1A:79:XX:XX:XX"
                  maxLength={17}
                  className="w-full h-11 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary font-mono focus:border-amber-500 transition-fast"
                />
              </div>
              
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <p className="text-sm text-emerald-400">📅 Validade IBO: <strong>365 dias</strong></p>
                {isUniplay && workflow.config?.trial_hours && (
                  <p className="text-sm text-blue-400 mt-1">⏱️ Teste Uniplay: <strong>{workflow.config.trial_hours}h</strong></p>
                )}
              </div>
              
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 h-11 bg-bg-tertiary text-text-primary font-semibold rounded-xl">
                  Cancelar
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executing || !form.name || !form.mac_address}
                  className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {executing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play size={18} /> Executar</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
