// components/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Settings, 
  LogOut,
  Tv,
  Server,
  FlaskConical
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-[280px] bg-bg-secondary border-r border-border-color flex flex-col fixed h-screen z-50">
      {/* Logo */}
      <div className="p-6 border-b border-border-color">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-ibo-primary via-koffice-primary to-playlist-primary rounded-xl flex items-center justify-center text-lg font-bold text-white">
            U
          </div>
          <span className="text-xl font-bold text-text-primary">UniPanel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {/* Geral */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-2">
            Geral
          </p>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast ${
                isActive
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            <LayoutDashboard size={20} />
            <span className="text-sm font-medium">Dashboard</span>
          </NavLink>
        </div>

        {/* IBO Revenda */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-2">
            IBO Revenda
          </p>
          
          <NavLink
            to="/gerencia"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-ibo-glow text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-ibo-primary rounded-r" />
                )}
                <Users size={20} className="text-ibo-primary" />
                <span className="text-sm font-medium">Usuários</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/gerencia/criar"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-ibo-glow text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-ibo-primary rounded-r" />
                )}
                <UserPlus size={20} className="text-ibo-primary" />
                <span className="text-sm font-medium">Criar Usuário</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/gerencia/contas"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-ibo-glow text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-ibo-primary rounded-r" />
                )}
                <Settings size={20} className="text-ibo-primary" />
                <span className="text-sm font-medium">Contas</span>
              </>
            )}
          </NavLink>
        </div>

        {/* Koffice */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-2">
            Koffice
          </p>
          
          <NavLink
            to="/koffice"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-cyan-500/10 text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-cyan-500 rounded-r" />
                )}
                <Users size={20} className="text-cyan-500" />
                <span className="text-sm font-medium">Clientes</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/koffice/contas"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-cyan-500/10 text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-cyan-500 rounded-r" />
                )}
                <Server size={20} className="text-cyan-500" />
                <span className="text-sm font-medium">Contas</span>
              </>
            )}
          </NavLink>
        </div>

        {/* Playlist Manager */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-2">
            Playlist Manager
          </p>
          
          <NavLink
            to="/playlist"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-fast relative ${
                isActive
                  ? 'bg-purple-500/10 text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-purple-500 rounded-r" />
                )}
                <Tv size={20} className="text-purple-500" />
                <span className="text-sm font-medium">Clientes</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border-color">
        <div className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
          <div className="w-9 h-9 bg-gradient-to-br from-ibo-primary to-koffice-primary rounded-lg flex items-center justify-center font-semibold text-sm">
            {user?.name?.[0] || user?.username?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
            <p className="text-xs text-text-muted">Administrador</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-text-muted hover:text-red-400 transition-fast"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
