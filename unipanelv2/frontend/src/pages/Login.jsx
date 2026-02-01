// pages/Login.jsx
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { user, login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
  });

  // Se já está logado, redirecionar
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      
      if (isRegister) {
        if (!form.name) {
          toast.error('Nome é obrigatório');
          setLoading(false);
          return;
        }
        result = await register(form.username, form.password, form.name);
      } else {
        result = await login(form.username, form.password);
      }

      if (result.success) {
        toast.success(isRegister ? 'Conta criada!' : 'Bem-vindo!');
      } else {
        toast.error(result.error || 'Erro ao autenticar');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-ibo-primary via-koffice-primary to-playlist-primary rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
            U
          </div>
          <h1 className="text-2xl font-bold text-text-primary">UniPanel</h1>
          <p className="text-text-muted mt-1">Gerenciador Unificado</p>
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-6">
            {isRegister ? 'Criar Conta' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
                  placeholder="Seu nome"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Usuário
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
                placeholder="Digite seu usuário"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-12 bg-bg-tertiary border border-border-color rounded-xl px-4 pr-12 text-text-primary focus:border-ibo-primary focus:ring-2 focus:ring-ibo-glow transition-fast"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-fast"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-ibo-primary hover:bg-ibo-secondary text-white font-semibold rounded-xl transition-fast flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Aguarde...
                </>
              ) : (
                isRegister ? 'Criar Conta' : 'Entrar'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-text-muted hover:text-ibo-primary transition-fast"
            >
              {isRegister
                ? 'Já tem conta? Entrar'
                : 'Não tem conta? Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
