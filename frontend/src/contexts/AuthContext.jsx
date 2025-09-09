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

    // Opcional: redirigir a login
    window.location.href = '/login';
  };

  // Nueva función para actualizar usuario
  const updateUser = (updatedUserData) => {
    // Mantener el token actual, solo actualizar datos del usuario
    const newUserData = {
      ...user,
      ...updatedUserData
    };
    
    setUser(newUserData);
    
    // Actualizar en localStorage
    localStorage.setItem('user', JSON.stringify(newUserData));
    
    console.log('Usuario actualizado en contexto:', newUserData);
  };

  // Helper para peticiones autenticadas
  const getAuthHeaders = (extraHeaders = {}) => {
    if (!token) return extraHeaders;
    return {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
    };
  };

  // Helper para hacer peticiones autenticadas
  const authenticatedFetch = async (url, options = {}) => {
    const headers = getAuthHeaders(options.headers || {});
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      // Si el token expiró o es inválido
      if (response.status === 401) {
        console.warn('Token expirado o inválido, cerrando sesión');
        logout();
        throw new Error('Sesión expirada');
      }

      return response;
    } catch (error) {
      console.error('Error en petición autenticada:', error);
      throw error;
    }
  };

  // Función para refrescar datos del usuario desde el servidor
  const refreshUserData = async () => {
    if (!token) return;

    try {
      const response = await authenticatedFetch('http://localhost:8000/usuarios/me');
      
      if (response.ok) {
        const userData = await response.json();
        updateUser(userData);
        return userData;
      }
    } catch (error) {
      console.error('Error al refrescar datos del usuario:', error);
    }
  };

  const value = {
    user,                   // objeto con info del usuario (incluye user.id)
    token,                  // JWT
    isAuthenticated,        // booleano
    loading,                // útil para "splash screen" o loaders globales
    login,                  // función para iniciar sesión
    logout,                 // función para cerrar sesión
    updateUser,             // NUEVA: función para actualizar datos del usuario
    getAuthHeaders,         // helper para fetch con auth
    authenticatedFetch,     // NUEVA: helper para peticiones con manejo de errores
    refreshUserData,        // NUEVA: función para refrescar datos desde servidor
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};