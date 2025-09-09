/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, logout, updateUser, authenticatedFetch } = useAuth();
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  // URL base del backend
  const API_BASE_URL = 'http://localhost:8000';

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || '',
        email: user.email || '',
        rol: user.rol || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });
      
      // Cargar avatar de Google
      loadGoogleAvatar(user.email);
    }
  }, [user]);

  // Función para cargar avatar de Google usando Gravatar (alternativa más simple)
  const loadGoogleAvatar = async (email) => {
    if (!email) return;
    
    setLoadingAvatar(true);
    
    try {
      // Usar Gravatar que funciona con cuentas de Google
      const emailHash = await generateMD5Hash(email.toLowerCase().trim());
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=150&d=mp`;
      
      // Verificar si la imagen existe
      const img = new Image();
      img.onload = () => {
        setAvatar(gravatarUrl);
        setLoadingAvatar(false);
      };
      img.onerror = () => {
        // Si no existe en Gravatar, usar una imagen por defecto
        setAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre || 'Usuario')}&size=150&background=0d6efd&color=ffffff`);
        setLoadingAvatar(false);
      };
      img.src = gravatarUrl;
      
    } catch (error) {
      console.error('Error al cargar avatar:', error);
      // Imagen por defecto con iniciales
      setAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre || 'Usuario')}&size=150&background=0d6efd&color=ffffff`);
      setLoadingAvatar(false);
    }
  };

  // Función para generar hash MD5 (necesario para Gravatar)
  const generateMD5Hash = async (text) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => {
      // Fallback si MD5 no está disponible
      return crypto.subtle.digest('SHA-256', data);
    });
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error específico
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    // Validar contraseñas solo si se quiere cambiar
    if (showPasswordFields) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'La contraseña actual es requerida';
      }

      if (!formData.newPassword) {
        newErrors.newPassword = 'La nueva contraseña es requerida';
      } else if (formData.newPassword.length < 6) {
        newErrors.newPassword = 'La nueva contraseña debe tener al menos 6 caracteres';
      }

      if (!formData.confirmNewPassword) {
        newErrors.confirmNewPassword = 'Confirma la nueva contraseña';
      } else if (formData.newPassword !== formData.confirmNewPassword) {
        newErrors.confirmNewPassword = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Actualizar perfil
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const updateData = {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol
      };

      // Incluir contraseñas solo si se están cambiando
      if (showPasswordFields) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      console.log('Actualizando perfil:', updateData);

      const response = await fetch(`${API_BASE_URL}/usuarios/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al actualizar perfil');
      }

      const updatedUser = await response.json();
      console.log('Perfil actualizado:', updatedUser);

      // Actualizar contexto de usuario
      updateUser(updatedUser);

      // Si cambió el email, recargar avatar
      if (formData.email !== user.email) {
        loadGoogleAvatar(formData.email);
      }

      // Limpiar campos de contraseña
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
      setShowPasswordFields(false);

      alert('¡Perfil actualizado exitosamente!');

    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout();
    }
  };

  if (!user) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <p>Debes iniciar sesión para ver tu perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow">
            <div className="card-body p-4">
              
              {/* Header con Avatar */}
              <div className="text-center mb-4">
                <div className="position-relative d-inline-block">
                  {loadingAvatar ? (
                    <div className="bg-light rounded-circle d-flex align-items-center justify-content-center" style={{width: '120px', height: '120px'}}>
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Cargando...</span>
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre || 'Usuario')}&size=120&background=0d6efd&color=ffffff`}
                      alt="Avatar" 
                      className="rounded-circle border border-3 border-primary"
                      style={{width: '120px', height: '120px', objectFit: 'cover'}}
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre || 'Usuario')}&size=120&background=0d6efd&color=ffffff`;
                      }}
                    />
                  )}
                </div>
                <h2 className="card-title text-primary mt-3 mb-1">Mi Perfil</h2>
                <p className="text-muted">Gestiona tu información personal</p>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Error general */}
                {errors.submit && (
                  <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <span className="me-2">⚠️</span>
                    {errors.submit}
                  </div>
                )}

                {/* Información básica */}
                <div className="row mb-4">
                  <div className="col-12">
                    <h5 className="text-primary border-bottom pb-2">
                      <span className="me-2">👤</span>
                      Información Personal
                    </h5>
                  </div>
                </div>

                {/* Nombre */}
                <div className="mb-3">
                  <label htmlFor="nombre" className="form-label">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre completo"
                  />
                  {errors.nombre && (
                    <div className="invalid-feedback">
                      {errors.nombre}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                  />
                  {errors.email && (
                    <div className="invalid-feedback">
                      {errors.email}
                    </div>
                  )}
                  <small className="text-muted">
                    Cambiar tu email actualizará tu foto de perfil automáticamente
                  </small>
                </div>

                {/* Rol (solo lectura) */}
                <div className="mb-3">
                  <label htmlFor="rol" className="form-label">
                    Tipo de cuenta
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light"
                    id="rol"
                    value={formData.rol === 'usuario' ? 'Usuario' : formData.rol === 'duenio' ? 'Dueño de Estacionamiento' : 'Administrador'}
                    disabled
                  />
                  <small className="text-muted">
                    Contacta al administrador para cambiar tu tipo de cuenta
                  </small>
                </div>

                {/* Sección de contraseña */}
                <div className="row mb-4 mt-4">
                  <div className="col-12">
                    <h5 className="text-primary border-bottom pb-2">
                      <span className="me-2">🔒</span>
                      Seguridad
                    </h5>
                  </div>
                </div>

                {/* Botón para mostrar/ocultar campos de contraseña */}
                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                  >
                    {showPasswordFields ? (
                      <>
                        <span className="me-2">👁️</span>
                        Ocultar cambio de contraseña
                      </>
                    ) : (
                      <>
                        <span className="me-2">🔐</span>
                        Cambiar contraseña
                      </>
                    )}
                  </button>
                </div>

                {/* Campos de contraseña (condicionales) */}
                {showPasswordFields && (
                  <>
                    {/* Contraseña actual */}
                    <div className="mb-3">
                      <label htmlFor="currentPassword" className="form-label">
                        Contraseña actual
                      </label>
                      <input
                        type="password"
                        className={`form-control ${errors.currentPassword ? 'is-invalid' : ''}`}
                        id="currentPassword"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="Tu contraseña actual"
                      />
                      {errors.currentPassword && (
                        <div className="invalid-feedback">
                          {errors.currentPassword}
                        </div>
                      )}
                    </div>

                    {/* Nueva contraseña */}
                    <div className="mb-3">
                      <label htmlFor="newPassword" className="form-label">
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        className={`form-control ${errors.newPassword ? 'is-invalid' : ''}`}
                        id="newPassword"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleChange}
                        placeholder="Mínimo 6 caracteres"
                      />
                      {errors.newPassword && (
                        <div className="invalid-feedback">
                          {errors.newPassword}
                        </div>
                      )}
                    </div>

                    {/* Confirmar nueva contraseña */}
                    <div className="mb-3">
                      <label htmlFor="confirmNewPassword" className="form-label">
                        Confirmar nueva contraseña
                      </label>
                      <input
                        type="password"
                        className={`form-control ${errors.confirmNewPassword ? 'is-invalid' : ''}`}
                        id="confirmNewPassword"
                        name="confirmNewPassword"
                        value={formData.confirmNewPassword}
                        onChange={handleChange}
                        placeholder="Repite tu nueva contraseña"
                      />
                      {errors.confirmNewPassword && (
                        <div className="invalid-feedback">
                          {errors.confirmNewPassword}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Botones de acción */}
                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <span className="me-2">💾</span>
                        Guardar cambios
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleLogout}
                  >
                    <span className="me-2">🚪</span>
                    Cerrar sesión
                  </button>
                </div>

                {/* Información adicional */}
                <div className="text-center mt-4">
                  <small className="text-muted">
                    Tu foto de perfil se obtiene automáticamente desde tu cuenta de Google/Gravatar
                  </small>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;