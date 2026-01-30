// pages/Dashboard.jsx
import { useAuth } from '../contexts/AuthContext';
import { Users, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Olá, {user?.name || user?.username}! 👋
        </h1>
        <p className="text-text-muted mt-1">
          Bem-vindo ao UniPanel - seu gerenciador unificado
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon={<Users className="text-ibo-primary" />}
          label="Total de Clientes"
          value="—"
          trend={null}
          color="green"
        />
        <StatCard
          icon={<CheckCircle className="text-emerald-400" />}
          label="Ativos"
          value="—"
          trend={null}
          color="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="text-amber-400" />}
          label="Expirando em 7 dias"
          value="—"
          trend={null}
          color="amber"
        />
        <StatCard
          icon={<Activity className="text-blue-400" />}
          label="Ações (24h)"
          value="—"
          trend={null}
          color="blue"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-bg-card border border-border-color rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Começar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            href="/gerencia/contas"
            color="ibo"
            icon="⚙️"
            title="Configurar Conta"
            description="Adicione suas credenciais do GerenciaApp"
          />
          <QuickAction
            href="/gerencia"
            color="ibo"
            icon="👥"
            title="Ver Usuários"
            description="Gerencie os usuários da sua conta"
          />
          <QuickAction
            href="/gerencia/criar"
            color="ibo"
            icon="➕"
            title="Criar Usuário"
            description="Adicione um novo usuário"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }) {
  return (
    <div className="bg-bg-card border border-border-color rounded-2xl p-6 hover:border-border-light transition-fast">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}-500/10`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-md ${
            trend > 0 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-red-500/10 text-red-400'
          }`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-text-muted mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ href, color, icon, title, description }) {
  return (
    <a
      href={href}
      className={`block p-5 rounded-xl border border-border-color hover:border-${color}-primary/50 hover:bg-${color}-glow/50 transition-fast group`}
    >
      <span className="text-2xl">{icon}</span>
      <h3 className="font-semibold mt-3 group-hover:text-ibo-primary transition-fast">
        {title}
      </h3>
      <p className="text-sm text-text-muted mt-1">{description}</p>
    </a>
  );
}
