/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);

    // Guardar en localStorage
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);

    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Helper para peticiones autenticadas
  const getAuthHeaders = (extraHeaders = {}) => {
    if (!token) return extraHeaders;
    return {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
    };
  };

  const value = {
    user,               // objeto con info del usuario (incluye user.id)
    token,              // JWT
    isAuthenticated,    // booleano
    loading,            // útil para "splash screen" o loaders globales
    login,              // función para iniciar sesión
    logout,             // función para cerrar sesión
    getAuthHeaders,     // helper para fetch con auth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
