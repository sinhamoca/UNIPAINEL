// contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar usuário do localStorage ao iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      
      // Validar token
      authAPI.getMe()
        .then(res => {
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          // Token inválido
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const response = await authAPI.login(username, password);
    
    if (response.data.success) {
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    }
    
    return { success: false, error: response.data.error };
  };

  const register = async (username, password, name) => {
    const response = await authAPI.register(username, password, name);
    
    if (response.data.success) {
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    }
    
    return { success: false, error: response.data.error };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
