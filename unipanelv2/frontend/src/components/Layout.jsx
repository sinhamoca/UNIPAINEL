// components/Layout.jsx
import { useState, useEffect } from 'react';
import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Loader2, 
  Menu, 
  X, 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Settings, 
  LogOut,
  Tv,
  Server,
  ChevronLeft,
  ChevronRight,
  Radio  // ← ADICIONADO: ícone para Uniplay
} from 'lucide-react';

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  
  // Estado do sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: drawer aberto/fechado
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop: colapsado/expandido
  
  // Detectar se é mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false); // Fechar drawer mobile quando expandir
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Fechar sidebar mobile ao navegar
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ibo-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { section: 'Geral', items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: 'text-text-secondary', bg: 'bg-bg-tertiary' }
    ]},
    { section: 'IBO Revenda', items: [
      { to: '/gerencia', icon: Users, label: 'Usuários', color: 'text-ibo-primary', bg: 'bg-ibo-glow', end: true },
      { to: '/gerencia/criar', icon: UserPlus, label: 'Criar Usuário', color: 'text-ibo-primary', bg: 'bg-ibo-glow' },
      { to: '/gerencia/contas', icon: Settings, label: 'Contas', color: 'text-ibo-primary', bg: 'bg-ibo-glow' }
    ]},
    { section: 'Koffice', items: [
      { to: '/koffice', icon: Server, label: 'Contas', color: 'text-cyan-500', bg: 'bg-cyan-500/10', end: true }
    ]},
    { section: 'Playlist Manager', items: [
      { to: '/playlist', icon: Tv, label: 'Clientes', color: 'text-purple-500', bg: 'bg-purple-500/10', end: true }
    ]},
    { section: 'Sigma', items: [
      { to: '/sigma', icon: Server, label: 'Contas', color: 'text-violet-500', bg: 'bg-violet-500/10', end: true }
    ]},
    // ↓↓↓ ADICIONADO: Seção Uniplay ↓↓↓
    { section: 'Uniplay', items: [
      { to: '/uniplay', icon: Radio, label: 'Contas', color: 'text-orange-500', bg: 'bg-orange-500/10', end: true }
    ]}
    // ↑↑↑ FIM DA SEÇÃO UNIPLAY ↑↑↑
  ];

  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[260px]';
  const mainMargin = isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]');

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Overlay mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-bg-secondary border-r border-border-color flex flex-col z-50
        transition-all duration-300 ease-in-out
        ${isMobile 
          ? `w-[280px] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}` 
          : sidebarWidth
        }
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-border-color flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-ibo-primary via-koffice-primary to-playlist-primary rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              U
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <span className="text-xl font-bold text-text-primary whitespace-nowrap">UniPanel</span>
            )}
          </div>
          
          {/* Botão fechar (mobile) */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
            >
              <X size={20} />
            </button>
          )}
          
          {/* Botão colapsar (desktop) */}
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast"
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {navItems.map((group) => (
            <div key={group.section} className="mb-4">
              {(!sidebarCollapsed || isMobile) && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-2">
                  {group.section}
                </p>
              )}
              {sidebarCollapsed && !isMobile && (
                <div className="h-px bg-border-color mx-2 mb-2" />
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-fast relative mb-1 ${
                      isActive
                        ? `${item.bg || 'bg-bg-tertiary'} text-text-primary`
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    } ${sidebarCollapsed && !isMobile ? 'justify-center' : ''}`
                  }
                  title={sidebarCollapsed && !isMobile ? item.label : undefined}
                >
                  <item.icon size={20} className={item.color} />
                  {(!sidebarCollapsed || isMobile) && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border-color">
          <div className={`flex items-center gap-3 p-2 bg-bg-tertiary rounded-lg ${sidebarCollapsed && !isMobile ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 bg-gradient-to-br from-ibo-primary to-koffice-primary rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {user?.name?.[0] || user?.username?.[0] || 'U'}
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
                  <p className="text-xs text-text-muted">Admin</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-text-muted hover:text-red-400 transition-fast"
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`min-h-screen transition-all duration-300 ${mainMargin}`}>
        {/* Header mobile */}
        {isMobile && (
          <header className="sticky top-0 z-30 bg-bg-secondary border-b border-border-color px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-fast -ml-2"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-ibo-primary via-koffice-primary to-playlist-primary rounded-lg flex items-center justify-center text-sm font-bold text-white">
                U
              </div>
              <span className="font-semibold text-text-primary">UniPanel</span>
            </div>
          </header>
        )}
        
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}