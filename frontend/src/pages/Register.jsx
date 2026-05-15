import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'http://localhost:8000';
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const initialFormData = {
  nombre: '',
  email: '',
  password: '',
  confirmPassword: '',
  rol: 'usuario'
};

const Registro = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = useMemo(() => {
    const length = formData.password.length;
    if (!length) return { label: 'Sin definir', className: 'bg-secondary', value: 0 };
    if (length < 6) return { label: 'Muy corta', className: 'bg-danger', value: 25 };
    if (length < 8) return { label: 'Aceptable', className: 'bg-warning', value: 50 };
    if (length < 12) return { label: 'Buena', className: 'bg-info', value: 75 };
    return { label: 'Fuerte', className: 'bg-success', value: 100 };
  }, [formData.password]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setErrors((prev) => {
      if (!prev[name] && !prev.submit) return prev;
      return {
        ...prev,
        [name]: '',
        submit: ''
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.nombre.trim()) {
      nextErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'El correo es requerido';
    } else if (!EMAIL_REGEX.test(formData.email)) {
      nextErrors.email = 'Ingresa un correo válido';
    }

    if (!formData.password) {
      nextErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      nextErrors.password = 'Debe tener al menos 6 caracteres';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (!formData.rol) {
      nextErrors.rol = 'Selecciona un tipo de cuenta';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const safeJsonParse = async (response) => {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Error ${response.status}: Respuesta inválida del servidor`);
    }
  };

  const getErrorMessage = (status, statusText, payload) => {
    if (!payload) return `Error ${status}: ${statusText}`;
    if (typeof payload.detail === 'string') return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail.map((item) => item?.msg || 'Error de validación').join(', ');
    }
    return `Error ${status}: ${statusText}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const registerResponse = await fetch(`${API_BASE_URL}/usuarios/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          rol: formData.rol
        })
      });

      if (!registerResponse.ok) {
        const errorData = await safeJsonParse(registerResponse);
        throw new Error(getErrorMessage(registerResponse.status, registerResponse.statusText, errorData));
      }

      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      if (!loginResponse.ok) {
        const errorData = await safeJsonParse(loginResponse);
        throw new Error(getErrorMessage(loginResponse.status, loginResponse.statusText, errorData));
      }

      const loginData = await safeJsonParse(loginResponse);
      if (!loginData?.token || !loginData?.usuario) {
        throw new Error('No se pudo iniciar sesión automáticamente. Intenta iniciar sesión manualmente.');
      }

      login(loginData.usuario, loginData.token);
      setFormData(initialFormData);
      const redirectPath = loginData.usuario.rol === 'duenio' ? '/home_duenio' : '/home_usuario';
      navigate(redirectPath);
    } catch (error) {
      setErrors({ submit: error.message || 'Error desconocido del servidor' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px circle at 10% 10%, #eef2ff 0%, #e9ecff 28%, #f8f9ff 52%, #f5f7ff 100%)'
      }}
    >
      <div className="login-backdrop">
        <div className="glow glow-1" aria-hidden="true"></div>
        <div className="glow glow-2" aria-hidden="true"></div>

        <div className="login-card">
          <div className="login-aside d-none d-md-flex">
            <div className="aside-content">
              <div className="brand-badge">AP</div>
              <h2 className="fw-bold text-white mb-2">AppsPark</h2>
              <p className="text-white-50 mb-4">
                Crea tu cuenta y administra tus reservas de forma simple y segura.
              </p>
              <div className="aside-list">
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Registro en segundos
                </div>
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Acceso según tu rol
                </div>
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Experiencia rápida y clara
                </div>
              </div>
            </div>
          </div>

          <div className="login-main">
            <div className="login-header">
              <div className="brand-badge d-md-none">AP</div>
              <div>
                <h2 className="fw-bold text-dark mb-1">AppsPark</h2>
                <p className="text-muted mb-0">Registro de cuenta</p>
              </div>
            </div>

            <div className="login-body">
              <h4 className="text-center mb-2">Crear cuenta</h4>
              <p className="text-center text-muted mb-4">
                Completa tus datos para comenzar
              </p>

              {errors.submit && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {errors.submit}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label htmlFor="nombre" className="form-label">Nombre completo</label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    className={`form-control form-control-lg ${errors.nombre ? 'is-invalid' : ''}`}
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre"
                    disabled={loading}
                  />
                  {errors.nombre && <div className="invalid-feedback">{errors.nombre}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Correo electrónico</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={`form-control form-control-lg ${errors.email ? 'is-invalid' : ''}`}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="usuario@ejemplo.com"
                    disabled={loading}
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="rol" className="form-label">Tipo de cuenta</label>
                  <select
                    id="rol"
                    name="rol"
                    className={`form-select form-select-lg ${errors.rol ? 'is-invalid' : ''}`}
                    value={formData.rol}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="usuario">Usuario</option>
                    <option value="duenio">Dueño de estacionamiento</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {errors.rol && <div className="invalid-feedback">{errors.rol}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Contraseña</label>
                  <div className="input-group">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`form-control form-control-lg ${errors.password ? 'is-invalid' : ''}`}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                    >
                      {showPassword ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                  {errors.password && <div className="text-danger small mt-1">{errors.password}</div>}
                  <div className="progress mt-2" style={{ height: '6px' }}>
                    <div
                      className={`progress-bar ${passwordStrength.className}`}
                      role="progressbar"
                      style={{ width: `${passwordStrength.value}%` }}
                    ></div>
                  </div>
                  <small className="text-muted">Fortaleza: {passwordStrength.label}</small>
                </div>

                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">Confirmar contraseña</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control form-control-lg ${errors.confirmPassword ? 'is-invalid' : ''}`}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
                </div>

                <button type="submit" className="btn btn-primary w-100 fw-bold btn-lg" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus me-2"></i> Crear cuenta
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-4 login-links">
                <span className="text-muted">¿Ya tienes cuenta?</span>
                <Link to="/login" className="text-decoration-none ms-2">Iniciar sesión</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-backdrop {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
        }
        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.55;
          z-index: 0;
        }
        .glow-1 {
          width: 240px;
          height: 240px;
          background: #c7d2fe;
          top: 8%;
          left: 8%;
        }
        .glow-2 {
          width: 320px;
          height: 320px;
          background: #e0e7ff;
          bottom: 6%;
          right: 12%;
        }
        .login-card {
          background: white;
          border-radius: 18px;
          box-shadow: 0 18px 40px rgba(60, 70, 140, 0.18);
          overflow: hidden;
          max-width: 920px;
          width: 100%;
          border: 1px solid rgba(120, 130, 200, 0.15);
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          position: relative;
          z-index: 1;
        }
        .login-header {
          background: linear-gradient(135deg, #eef1ff 0%, #f8f9ff 100%);
          padding: 1.75rem 2rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .brand-badge {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #fff;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.5px;
          box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
        }
        .login-aside {
          background: linear-gradient(150deg, #1f2557 0%, #2b2f77 52%, #3a3fa3 100%);
          padding: 2.5rem 2.25rem;
          position: relative;
          overflow: hidden;
        }
        .login-aside::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          right: -80px;
          top: -60px;
        }
        .aside-content {
          position: relative;
          z-index: 1;
        }
        .aside-list {
          display: grid;
          gap: 0.75rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
        }
        .aside-item i {
          color: #c7d2fe;
        }
        .login-main {
          display: flex;
          flex-direction: column;
        }
        .login-body {
          padding: 2rem;
        }
        .btn-primary {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          border: none;
          border-radius: 8px;
          padding: 12px;
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(79, 70, 229, 0.25);
        }
        .form-control,
        .form-select {
          border-radius: 8px;
          padding: 12px 15px;
          border: 1px solid #d7d9f0;
          background: #fafbff;
        }
        .form-control:focus,
        .form-select:focus {
          box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
        }
        .login-links a {
          color: #4f46e5;
          font-weight: 500;
        }
        @media (max-width: 768px) {
          .login-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Registro;
