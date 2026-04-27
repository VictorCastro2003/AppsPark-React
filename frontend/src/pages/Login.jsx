/* eslint-disable no-unused-vars */
import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Importar el contexto

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth(); // Usar el contexto de autenticación

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/login", { email, password });
      
      // Usar la función login del contexto en lugar de localStorage directamente
      login(res.data.usuario, res.data.token);

      // Navegar según el rol
      if (res.data.usuario.rol === "duenio") {
        navigate("/Home_Duenio");
      } else {
        navigate("/Home_Usuario");
      }
    } catch (err) {
      console.error("Error en login:", err); // Debug
      setError("Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px circle at 10% 10%, #eef2ff 0%, #e9ecff 28%, #f8f9ff 52%, #f5f7ff 100%)",
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
                Gestión clara de tu parqueo y clientes, en un solo lugar.
              </p>
              <div className="aside-list">
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Control en tiempo
                  real
                </div>
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Reportes simples y
                  útiles
                </div>
                <div className="aside-item">
                  <i className="fas fa-check-circle me-2"></i>Acceso rápido y
                  seguro
                </div>
              </div>
         
            </div>
          </div>

          <div className="login-main">
            <div className="login-header">
              <div className="brand-badge d-md-none">AP</div>
              <div>
                <h2 className="fw-bold text-dark mb-1">AppsPark</h2>
                <p className="text-muted mb-0">Acceso al panel</p>
              </div>
            </div>

            <div className="login-body">
              <h4 className="text-center mb-2">Bienvenido de nuevo</h4>
              <p className="text-center text-muted mb-4">
                Ingresa tus credenciales para continuar
              </p>

              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    id="email"
                    name="email"
                    placeholder="usuario@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3 d-flex justify-content-between align-items-center">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="rememberMe"
                    />
                    <label className="form-check-label" htmlFor="rememberMe">
                      Recordarme
                    </label>
                  </div>
                  <a href="#" className="text-decoration-none small-link">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-bold btn-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt me-2"></i> Entrar
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-4 login-links">
                <span className="text-muted">¿No tienes cuenta?</span>
                <a href="#" className="text-decoration-none ms-2">
                  Crear una cuenta
                </a>
              </div>

              <div className="mt-4 test-accounts">
                <h6 className="mb-2">Cuentas de prueba:</h6>
                <small className="text-muted">
                  <strong>Usuario:</strong> user@example.com / string
                  <br />
                  <strong>Dueño:</strong> user2@example.com / string
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos propios integrados */}
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
          text-align: left;
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
        .aside-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          font-size: 0.85rem;
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
        .form-control {
          border-radius: 8px;
          padding: 12px 15px;
          border: 1px solid #d7d9f0;
          background: #fafbff;
        }
        .form-control:focus {
          box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
        }
        .login-links a {
          color: #4f46e5;
          font-weight: 500;
        }
        .small-link {
          color: #4f46e5;
          font-weight: 500;
          font-size: 0.9rem;
        }
        .test-accounts {
          background: #f5f6ff;
          border: 1px dashed #c7d2fe;
          border-radius: 12px;
          padding: 0.9rem 1rem;
        }
        @media (max-width: 768px) {
          .login-card {
            grid-template-columns: 1fr;
          }
          .login-header {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
