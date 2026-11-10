import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export type Role = 'GERENTE' | 'MECANICO' | 'BODEGUERO' | 'CONTADOR' | 'CLIENTE' | 'PROVEEDOR';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Restaurar sesión desde localStorage
    const initAuth = async () => {
      const token = localStorage.getItem('geartrace_token');
      if (token) {
        try {
          // Validar el token contra el backend
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error("Token inválido o expirado");
          localStorage.removeItem('geartrace_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Escuchar evento de interceptor de axios
    const handleUnauthorized = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  const login = (token: string, userData: User) => {
    localStorage.setItem('geartrace_token', token);
    setUser(userData);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('geartrace_token');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
