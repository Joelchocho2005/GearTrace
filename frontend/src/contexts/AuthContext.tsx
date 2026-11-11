import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/resources';
import { AUTH_UNAUTHORIZED_EVENT, clearSession, getToken, saveToken } from '../api/session';

/** Roles del backend (enum Role de Prisma), en el orden en que se muestran. */
export const ROLES = ['GERENTE', 'MECANICO', 'BODEGUERO', 'CONTADOR', 'CLIENTE', 'PROVEEDOR'] as const;
export type Role = (typeof ROLES)[number];

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
      if (getToken()) {
        try {
          // Validar el token contra el backend
          setUser(await authApi.me());
        } catch (error) {
          console.error('Token inválido o expirado', error);
          clearSession();
        }
      }
      setIsLoading(false);
    };

    void initAuth();

    // Escuchar evento de interceptor de axios
    const handleUnauthorized = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate]);

  const login = (token: string, userData: User) => {
    saveToken(token);
    setUser(userData);
    navigate('/dashboard');
  };

  const logout = () => {
    clearSession();
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
