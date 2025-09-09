import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; 

const Registro = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    rol: 'usuario' // Cambiado para coincidir con el enum del backend
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // URL base del backend
  const API_BASE_URL = 'http://localhost:8000';

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error específico cuando el usuario empiece a escribir
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

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (!formData.rol) {
      newErrors.rol = 'Selecciona un rol';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Función auxiliar para parsear respuesta JSON de forma segura
  const safeJsonParse = async (response) => {
    const text = await response.text();
    if (!text) {
      throw new Error(`Error ${response.status}: Respuesta vacía del servidor`);
    }
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Error ${response.status}: Respuesta inválida del servidor`);
    }
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      console.log('Enviando datos de registro:', {
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol
      });

      // Registro del usuario - URL corregida (sin /api/)
      const registerResponse = await fetch(`${API_BASE_URL}/usuarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          email: formData.email,
          password: formData.password,
          rol: formData.rol
        }),
      });

      console.log('Respuesta de registro status:', registerResponse.status);

      if (!registerResponse.ok) {
        let errorMessage = `Error ${registerResponse.status}`;
        try {
          const errorData = await safeJsonParse(registerResponse);
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          console.error('Error al parsear respuesta de error:', parseError);
          errorMessage = `Error ${registerResponse.status}: ${registerResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Parsear respuesta de registro
      const registerData = await safeJsonParse(registerResponse);
      console.log('Registro exitoso:', registerData);

      // Si el registro es exitoso, hacer login automáticamente
      console.log('Intentando login automático...');
      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      console.log('Respuesta de login status:', loginResponse.status);

      if (!loginResponse.ok) {
        let errorMessage = `Error en login: ${loginResponse.status}`;
        try {
          const errorData = await safeJsonParse(loginResponse);
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          console.error('Error al parsear respuesta de login:', parseError);
          errorMessage = `Error de login ${loginResponse.status}: ${loginResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const loginData = await safeJsonParse(loginResponse);
      console.log('Login exitoso:', loginData);
      
      // Verificar que tengamos los datos necesarios
      if (!loginData.token || !loginData.usuario) {
        throw new Error('Respuesta de login incompleta');
      }

      // Usar el contexto de autenticación para hacer login
      login(loginData.usuario, loginData.token);

      // Mostrar mensaje de éxito
      alert('¡Registro exitoso! Bienvenido/a');
      
      // Reset form
      setFormData({
        nombre: '',
        email: '',
        password: '',
        confirmPassword: '',
        rol: 'usuario'
      });

    } catch (error) {
      console.error('Error completo en el registro:', error);
      setErrors({ submit: error.message || 'Error desconocido en el servidor' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <h2 className="card-title text-primary mb-2">Crear Cuenta</h2>
                <p className="text-muted">Regístrate para comenzar</p>
              </div>

              <div>
                {/* Error general */}
                {errors.submit && (
                  <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <span className="me-2">⚠️</span>
                    {errors.submit}
                  </div>
                )}

                {/* Nombre */}
                <div className="mb-3">
                  <label htmlFor="nombre" className="form-label">
                    <span className="me-1">👤</span>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Ingresa tu nombre completo"
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
                    <span className="me-1">📧</span>
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
                </div>

                {/* Rol */}
                <div className="mb-3">
                  <label htmlFor="rol" className="form-label">
                    <span className="me-1">🏷️</span>
                    Tipo de cuenta
                  </label>
                  <select
                    className={`form-select ${errors.rol ? 'is-invalid' : ''}`}
                    id="rol"
                    name="rol"
                    value={formData.rol}
                    onChange={handleChange}
                  >
                    <option value="usuario">Usuario</option>
                    <option value="duenio">Dueño de Estacionamiento</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {errors.rol && (
                    <div className="invalid-feedback">
                      {errors.rol}
                    </div>
                  )}
                </div>

                {/* Contraseña */}
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    <span className="me-1">🔒</span>
                    Contraseña
                  </label>
                  <div className="input-group">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {errors.password && (
                    <div className="text-danger small mt-1">
                      {errors.password}
                    </div>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">
                    <span className="me-1">🔐</span>
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repite tu contraseña"
                  />
                  {errors.confirmPassword && (
                    <div className="invalid-feedback">
                      {errors.confirmPassword}
                    </div>
                  )}
                </div>

                {/* Botón de registro */}
                <div className="d-grid">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                    onClick={handleSubmit}
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        <span className="me-2">➕</span>
                        Crear cuenta
                      </>
                    )}
                  </button>
                </div>

                {/* Link para login */}
                <div className="text-center mt-3">
                  <p className="mb-0 text-muted">
                    ¿Ya tienes cuenta?{' '}
                    <a href="/login" className="text-decoration-none">
                      Inicia sesión aquí
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registro;