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
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div className="login-card">
        <div className="login-header">
          <h2 className="fw-bold text-dark mb-0">AppsPark</h2>
        </div>
        <div className="login-body">
          <h4 className="text-center mb-4">Iniciar Sesión en AppsPark</h4>

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
                className="form-control"
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
                className="form-control"
                id="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="rememberMe"
              />
              <label className="form-check-label" htmlFor="rememberMe">
                Recordarme
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 fw-bold"
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

          <div className="text-center mt-4">
            <a href="#" className="text-decoration-none me-3">
              ¿Olvidaste tu contraseña?
            </a>
            <span className="text-muted">|</span>
            <a href="#" className="text-decoration-none ms-3">
              Crear una cuenta
            </a>
          </div>

          <div className="mt-4 p-3 bg-light rounded">
            <h6 className="mb-2">Cuentas de prueba:</h6>
            <small className="text-muted">
              <strong>Admin:</strong> user@example.com / string
              <br />
              <strong>Usuario:</strong> user2@example.com / string
            </small>
          </div>
        </div>
      </div>

      {/* Estilos propios integrados */}
      <style>{`
        .login-card {
          background: white;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          overflow: hidden;
          max-width: 400px;
          width: 100%;
        }
        .login-header {
          background: #f8f9fa;
          padding: 2rem;
          text-align: center;
          border-bottom: 1px solid #e9ecef;
        }
        .login-body {
          padding: 2rem;
        }
        .btn-primary {
          background: #007bff;
          border: none;
          border-radius: 8px;
          padding: 12px;
        }
        .form-control {
          border-radius: 8px;
          padding: 12px 15px;
          border: 1px solid #ddd;
        }
        .form-control:focus {
          box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25);
          border-color: #007bff;
        }
      `}</style>
    </div>
  );
}