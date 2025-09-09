import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Ajusta la ruta según tu estructura

export default function Sidebar({ currentPage = "inicio" }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Función para obtener las rutas según el rol del usuario
  const getMenuItems = () => {
    const isDuenio = user?.rol === "duenio";
    
    return [
      { 
        icon: "bi-house-fill", 
        label: "Inicio", 
        key: "inicio", 
        route: isDuenio ? "/Home_Duenio" : "/Home_Usuario" 
      },
      { 
        icon: "bi-search", 
        label: isDuenio ? "Gestionar Estacionamientos" : "Buscar Estacionamiento", 
        key: "buscar", 
        route: isDuenio ? "/Home_Duenio" : "/Home_Usuario" 
      },
      { 
        icon: "bi-calendar3", 
        label: "Mis Reservas", 
        key: "reservas", 
        route: isDuenio ? "/reservas-duenio" : "/mis_reservas" 
      },
      { 
        icon: "bi-person-fill", 
        label: "Mi Perfil", 
        key: "perfil", 
        route: "/perfil" 
      },
      { 
        icon: "bi-clock-history", 
        label: "Historial", 
        key: "historial", 
        route: isDuenio ? "/historial-duenio" : "/historial" 
      }
    ];
  };

  const menuItems = getMenuItems();

  const handleMenuClick = (item) => {
    if (item.route) {
      navigate(item.route);
    }
  };

  const handleLogout = () => {
    if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      try {
        console.log("Cerrando sesión...");
        logout(); // Llamada al logout del contexto
        navigate("/login", { replace: true });
        console.log("Sesión cerrada exitosamente");
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("Error al cerrar sesión. Por favor intenta de nuevo.");
      }
    }
  };

  // Debug: mostrar información del usuario
  console.log("Usuario actual:", user);

  // Obtener el nombre del usuario correctamente
  const getUserName = () => {
    if (!user) return "Usuario";
    
    // Verificar diferentes propiedades que puede tener el usuario
    if (user.nombre && user.nombre !== "string") return user.nombre;
    if (user.username && user.username !== "string") return user.username;
    if (user.name && user.name !== "string") return user.name;
    
    return "Usuario";
  };

  const getUserEmail = () => {
    if (!user) return "Sin email";
    if (user.email && user.email !== "string") return user.email;
    return "Usuario activo";
  };

  const getUserInitials = () => {
    const name = getUserName();
    return name.charAt(0).toUpperCase();
  };

  // Función para obtener el rol del usuario para mostrar
  const getUserRole = () => {
    if (!user) return "";
    return user.rol === "duenio" ? "Propietario" : "Usuario";
  };

  return (
    <>
      {/* Sidebar */}
      <div 
        className={`bg-dark text-white vh-100 position-sticky top-0 d-flex flex-column ${
          isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        }`}
        style={{
          width: isCollapsed ? "70px" : "280px",
          transition: "width 0.3s ease-in-out",
          zIndex: 1040
        }}
      >
        {/* Header con Toggle */}
        <div className="position-relative flex-shrink-0">
          {/* Toggle Button */}
          <button
            className="btn btn-outline-light btn-sm position-absolute top-0 end-0 m-2"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expandir menú" : "Contraer menú"}
            style={{ zIndex: 1050 }}
          >
            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
          </button>

          {/* Brand */}
          <div className={`p-3 ${isCollapsed ? 'text-center' : ''}`} style={{ paddingTop: '3.5rem' }}>
            {!isCollapsed ? (
              <>
                <h4 className="mb-1 fw-bold">
                  <i className="bi bi-p-square-fill text-primary me-2"></i>
                  AppsPark
                </h4>
                <small className="text-muted">
                  {user?.rol === "duenio" ? "Panel de Propietario" : "Encuentra tu lugar"}
                </small>
              </>
            ) : (
              <i className="bi bi-p-square-fill text-primary fs-2"></i>
            )}
          </div>
        </div>

        <hr className="border-secondary mx-3 flex-shrink-0" />

        {/* User Profile */}
        <div className={`px-3 mb-4 flex-shrink-0 ${isCollapsed ? 'text-center' : ''}`}>
          {!isCollapsed ? (
            <div className="d-flex align-items-center p-2 rounded bg-secondary bg-opacity-25">
              <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0 ${
                user?.rol === "duenio" ? "bg-success" : "bg-primary"
              }`} 
                   style={{ width: "45px", height: "45px" }}>
                <span className="text-white fw-bold">{getUserInitials()}</span>
              </div>
              <div className="flex-grow-1 text-truncate">
                <h6 className="mb-0 text-white fw-semibold">
                  {getUserName()}
                </h6>
                <small className="text-muted">
                  {getUserRole()} • {getUserEmail()}
                </small>
              </div>
              {/* Botón de logout directo */}
              <button 
                className="btn btn-sm btn-outline-danger"
                onClick={handleLogout}
                title="Cerrar Sesión"
              >
                <i className="bi bi-box-arrow-right"></i>
              </button>
            </div>
          ) : (
            <div className="position-relative">
              <div className={`rounded-circle d-flex align-items-center justify-content-center mx-auto ${
                user?.rol === "duenio" ? "bg-success" : "bg-primary"
              }`} 
                   style={{ width: "45px", height: "45px" }}>
                <span className="text-white fw-bold">{getUserInitials()}</span>
              </div>
              {/* Botón de logout para vista colapsada */}
              <button 
                className="btn btn-sm btn-outline-danger position-absolute top-0 end-0"
                onClick={handleLogout}
                title="Cerrar Sesión"
                style={{ 
                  width: "25px", 
                  height: "25px", 
                  fontSize: "10px",
                  transform: "translate(50%, -50%)"
                }}
              >
                <i className="bi bi-box-arrow-right"></i>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="px-2 flex-grow-1 overflow-auto">
          <ul className="nav nav-pills flex-column">
            {menuItems.map((item) => (
              <li className="nav-item mb-1" key={item.key}>
                <button
                  className={`nav-link w-100 text-start border-0 rounded d-flex align-items-center ${
                    currentPage === item.key 
                      ? `active ${user?.rol === "duenio" ? "bg-success" : "bg-primary"} text-white` 
                      : 'text-light'
                  } ${isCollapsed ? 'justify-content-center px-2' : 'px-3'}`}
                  onClick={() => handleMenuClick(item)}
                  title={isCollapsed ? item.label : ""}
                  style={{
                    backgroundColor: currentPage === item.key ? '' : 'transparent',
                    transition: 'all 0.2s ease',
                    minHeight: '45px'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== item.key) {
                      e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== item.key) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <i className={`bi ${item.icon} ${isCollapsed ? '' : 'me-3'}`} 
                     style={{ fontSize: '1.1rem' }}></i>
                  {!isCollapsed && (
                    <span className="fw-medium">{item.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - Información adicional */}
        <div className="flex-shrink-0 p-2">
          {!isCollapsed && (
            <>
              <small className="text-muted d-block text-center mb-1">
                v1.0.0
              </small>
              {user?.rol === "duenio" && (
                <div className="text-center">
                  <small className="badge bg-success bg-opacity-25 text-success">
                    <i className="bi bi-shield-check me-1"></i>
                    Propietario
                  </small>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlay para móviles */}
      {!isCollapsed && window.innerWidth <= 768 && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark opacity-50 d-md-none"
          style={{ zIndex: 1030 }}
          onClick={() => setIsCollapsed(true)}
        ></div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css');
        
        .sidebar-collapsed {
          overflow: hidden;
        }
        
        .nav-link:not(.active):hover {
          transform: translateX(2px);
          background-color: rgba(255,255,255,0.1) !important;
        }
        
        .nav-link.active:hover {
          transform: none;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .sidebar-expanded {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100vh !important;
            z-index: 1040 !important;
            width: 280px !important;
          }
          
          .sidebar-collapsed {
            width: 0 !important;
            overflow: hidden !important;
          }
        }
        
        /* Custom scrollbar para el nav */
        nav::-webkit-scrollbar {
          width: 4px;
        }
        
        nav::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
        }
        
        nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
        }
        
        nav::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.5);
        }
      `}</style>
    </>
  );
}