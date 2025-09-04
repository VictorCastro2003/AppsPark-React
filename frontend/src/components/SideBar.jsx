import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ user, onLogout, currentPage = "inicio" }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { icon: "🏠", label: "Inicio", key: "inicio", route: "/home" },
    { icon: "🔍", label: "Buscar Estacionamiento", key: "buscar", route: "/home" },
    { icon: "📝", label: "Mis Reservas", key: "reservas", route: "/reservas" },
    { icon: "👤", label: "Mi Perfil", key: "perfil", route: "/perfil" },
    { icon: "📋", label: "Historial", key: "historial", route: "/historial" }
  ];

  const handleMenuClick = (item) => {
    if (item.route) {
      navigate(item.route);
    }
  };

  const handleLogout = () => {
    if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      onLogout();
    }
  };

  return (
    <div 
      className={`d-flex flex-column bg-dark text-white transition-all ${
        isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
      }`}
      style={{
        width: isCollapsed ? "80px" : "280px",
        minHeight: "100vh",
        transition: "width 0.3s ease",
        position: "relative"
      }}
    >
      {/* Toggle Button */}
      <button
        className="btn btn-link text-white position-absolute"
        style={{ 
          top: "10px", 
          right: isCollapsed ? "50%" : "10px",
          transform: isCollapsed ? "translateX(50%)" : "none",
          zIndex: 1000,
          padding: "5px 10px"
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expandir menú" : "Contraer menú"}
      >
        {isCollapsed ? "➡️" : "⬅️"}
      </button>

      {/* Header del sidebar */}
      <div className="p-4 pt-5">
        {!isCollapsed ? (
          <>
            <h4 className="text-white mb-1">AppsPark</h4>
            <small className="text-muted">Encuentra tu lugar</small>
          </>
        ) : (
          <div className="text-center">
            <div className="h4 mb-0">🅿️</div>
          </div>
        )}
      </div>
      
      <hr className="text-white-50 mx-3" />
      
      {/* User Info */}
      {!isCollapsed && (
        <div className="px-4 mb-3">
          <div className="d-flex align-items-center">
            <div 
              className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
              style={{ width: "40px", height: "40px", fontSize: "16px" }}
            >
              {(user?.username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="text-white fw-semibold text-truncate">
                {user?.username || "Usuario"}
              </div>
              <small className="text-muted">Usuario activo</small>
            </div>
          </div>
        </div>
      )}
      
      {isCollapsed && (
        <div className="text-center mb-3">
          <div 
            className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mx-auto" 
            style={{ width: "40px", height: "40px", fontSize: "16px" }}
          >
            {(user?.username || "U")[0].toUpperCase()}
          </div>
        </div>
      )}

      {/* Menu items */}
      <nav className="flex-grow-1 px-2">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`btn w-100 text-start mb-2 border-0 position-relative ${
              currentPage === item.key 
                ? 'btn-primary' 
                : 'btn-link text-white'
            }`}
            onClick={() => handleMenuClick(item)}
            style={{ 
              textDecoration: "none",
              padding: isCollapsed ? "12px 0" : "12px 16px",
              borderRadius: "8px"
            }}
            title={isCollapsed ? item.label : ""}
          >
            <div className={`d-flex align-items-center ${isCollapsed ? 'justify-content-center' : ''}`}>
              <span style={{ fontSize: "18px" }}>{item.icon}</span>
              {!isCollapsed && (
                <span className="ms-3 text-truncate">{item.label}</span>
              )}
            </div>
          </button>
        ))}
      </nav>
      
      {/* Footer / Logout */}
      <div className="p-3 border-top border-white-50">
        <button 
          className="btn btn-outline-light w-100 d-flex align-items-center justify-content-center"
          onClick={handleLogout}
          style={{ 
            padding: isCollapsed ? "12px 0" : "12px 16px",
            borderRadius: "8px"
          }}
          title={isCollapsed ? "Cerrar Sesión" : ""}
        >
          <span style={{ fontSize: "18px" }}>🚪</span>
          {!isCollapsed && <span className="ms-3">Cerrar Sesión</span>}
        </button>
      </div>

      {/* Styles */}
      <style jsx>{`
        .sidebar-collapsed .text-truncate,
        .sidebar-collapsed .ms-3 {
          display: none !important;
        }
        
        .btn:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        .btn-primary:hover {
          background-color: var(--bs-primary) !important;
          opacity: 0.9;
        }
        
        @media (max-width: 768px) {
          .sidebar-expanded {
            width: 100% !important;
            position: fixed;
            z-index: 1050;
            height: 100vh;
          }
          
          .sidebar-collapsed {
            width: 0 !important;
            overflow: hidden;
          }
        }
      `}</style>
    </div>
  );
}