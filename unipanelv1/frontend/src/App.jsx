// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GerenciaUsers from './pages/gerencia/Users';
import GerenciaAccounts from './pages/gerencia/Accounts';
import GerenciaCreateUser from './pages/gerencia/CreateUser';
import KofficeClients from './pages/koffice/Clients';
import KofficeAccounts from './pages/koffice/Accounts';
import KofficeResellers from './pages/koffice/Resellers';
import PlaylistClients from './pages/playlist/Clients';
import SigmaAccounts from './pages/sigma/Accounts';
import SigmaCustomers from './pages/sigma/Customers';
import SigmaResellers from './pages/sigma/Resellers';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login - sem layout */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas protegidas com layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            
            {/* IBO Revenda / GerenciaApp */}
            <Route path="/gerencia" element={<GerenciaUsers />} />
            <Route path="/gerencia/contas" element={<GerenciaAccounts />} />
            <Route path="/gerencia/criar" element={<GerenciaCreateUser />} />
            
            {/* Koffice */}
            <Route path="/koffice" element={<KofficeAccounts />} />
            <Route path="/koffice/:accountId/clients" element={<KofficeClients />} />
            <Route path="/koffice/:accountId/resellers" element={<KofficeResellers />} />
            
            {/* Playlist Manager */}
            <Route path="/playlist" element={<PlaylistClients />} />
            
            {/* Sigma */}
            <Route path="/sigma" element={<SigmaAccounts />} />
            <Route path="/sigma/:accountId/customers" element={<SigmaCustomers />} />
            <Route path="/sigma/:accountId/resellers" element={<SigmaResellers />} />
          </Route>
        </Routes>
      </BrowserRouter>
      
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#16161f',
            color: '#f0f0f5',
            border: '1px solid #2a2a3a',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#16161f',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#16161f',
            },
          },
        }}
      />
    </AuthProvider>
  );
}
