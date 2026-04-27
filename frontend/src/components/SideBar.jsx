/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Swal from 'sweetalert2';

export default function Sidebar({ currentPage = "inicio" }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
        route: isDuenio ? "/reservas_duenio" : "/mis_reservas" 
      },
      { 
        icon: "bi-person-fill", 
        label: "Mi Perfil", 
        key: "perfil", 
        route: "/profile" 
      },
      { 
        icon: "bi-clock-history", 
        label: "Notificaciones", 
        key: "notificaciones", 
        route: "/notificaciones" 
      }
    ];
  };

  const menuItems = getMenuItems();

  const handleMenuClick = (item) => {
    if (item.route) {
      navigate(item.route);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: "¿Estás seguro de que quieres salir?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: user?.rol === "duenio" ? '#28a745' : '#0d6efd',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      background: '#212529',
      color: '#fff',
      customClass: {
        popup: 'swal-dark-popup',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn'
      }
    });

    if (result.isConfirmed) {
      try {
        // Mostrar loading
        Swal.fire({
          title: 'Cerrando sesión...',
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
          background: '#212529',
          color: '#fff'
        });

        await logout();
        
        // Mostrar éxito
        await Swal.fire({
          icon: 'success',
          title: '¡Hasta pronto!',
          text: 'Sesión cerrada exitosamente',
          timer: 1500,
          showConfirmButton: false,
          background: '#212529',
          color: '#fff'
        });

        navigate("/login", { replace: true });
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cerrar la sesión. Por favor intenta de nuevo.',
          confirmButtonColor: '#dc3545',
          background: '#212529',
          color: '#fff'
        });
      }
    }
  };

  const getUserName = () => {
    if (!user) return "Usuario";
    if (user.nombre && user.nombre !== "string") return user.nombre;
    if (user.username && user.username !== "string") return user.username;
    if (user.name && user.name !== "string") return user.name;
    return "Usuario";
  };

  const getUserEmail = () => {
    if (!user) return "usuario@email.com";
    if (user.email && user.email !== "string") return user.email;
    return "usuario@email.com";
  };

  const getUserInitials = () => {
    const name = getUserName();
    return name.charAt(0).toUpperCase();
  };

  const getUserRole = () => {
    if (!user) return "";
    return user.rol === "duenio" ? "Propietario" : "Usuario";
  };

  const themeColor = user?.rol === "duenio" ? "#28a745" : "#0d6efd";

  return (
    <>
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
        {/* Header */}
        <div className="position-relative flex-shrink-0">
          <button
            className="btn btn-link text-white position-absolute top-0 end-0 m-2 p-1"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expandir menú" : "Contraer menú"}
            style={{ 
              zIndex: 1050,
              fontSize: "1.2rem",
              textDecoration: "none"
            }}
          >
            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
          </button>

          <div className={`p-3 ${isCollapsed ? 'text-center' : ''}`} style={{ paddingTop: '3.5rem' }}>
            {!isCollapsed ? (
              <>
                <h4 className="mb-0 fw-bold d-flex align-items-center">
                  <i className="bi bi-p-square-fill me-2" style={{ color: themeColor }}></i>
                  <span>AppsPark</span>
                </h4>
                <small className="text-muted d-block mt-1">
                  {user?.rol === "duenio" ? "Panel de Propietario" : "Encuentra tu lugar"}
                </small>
              </>
            ) : (
              <i className="bi bi-p-square-fill fs-2" style={{ color: themeColor }}></i>
            )}
          </div>
        </div>

        <hr className="border-secondary mx-3 my-2 flex-shrink-0" style={{ opacity: 0.3 }} />

        {/* User Profile - Simplificado */}
        <div className={`px-3 mb-3 flex-shrink-0 ${isCollapsed ? 'text-center' : ''}`}>
          {!isCollapsed ? (
            <div className="d-flex align-items-center p-3 rounded" 
                 style={{ 
                   backgroundColor: 'rgba(255,255,255,0.05)',
                   border: '1px solid rgba(255,255,255,0.1)'
                 }}>
              <div className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0" 
                   style={{ 
                     width: "50px", 
                     height: "50px",
                     backgroundColor: themeColor
                   }}>
                <span className="text-white fw-bold fs-5">{getUserInitials()}</span>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <h6 className="mb-0 text-white fw-semibold text-truncate">
                  {getUserName()}
                </h6>
                <small className="d-block text-truncate" style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                  {getUserEmail()}
                </small>
                <span className="badge mt-1" 
                      style={{ 
                        backgroundColor: `${themeColor}20`,
                        color: themeColor,
                        fontSize: "0.65rem",
                        fontWeight: "600"
                      }}>
                  {getUserRole()}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto" 
                 style={{ 
                   width: "50px", 
                   height: "50px",
                   backgroundColor: themeColor
                 }}>
              <span className="text-white fw-bold fs-5">{getUserInitials()}</span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="px-2 flex-grow-1 overflow-auto">
          <ul className="nav nav-pills flex-column mb-0">
            {menuItems.map((item) => (
              <li className="nav-item mb-1" key={item.key}>
                <button
                  className={`nav-link w-100 text-start border-0 rounded d-flex align-items-center ${
                    currentPage === item.key 
                      ? 'active text-white' 
                      : 'text-light'
                  } ${isCollapsed ? 'justify-content-center px-2' : 'px-3'}`}
                  onClick={() => handleMenuClick(item)}
                  title={isCollapsed ? item.label : ""}
                  style={{
                    backgroundColor: currentPage === item.key ? themeColor : 'transparent',
                    transition: 'all 0.2s ease',
                    minHeight: '48px',
                    fontWeight: currentPage === item.key ? '600' : '500'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== item.key) {
                      e.target.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== item.key) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <i className={`bi ${item.icon} ${isCollapsed ? '' : 'me-3'}`} 
                     style={{ fontSize: '1.2rem' }}></i>
                  {!isCollapsed && (
                    <span>{item.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="px-2 pb-3 flex-shrink-0">
          <button
            className={`btn w-100 text-start border-0 rounded d-flex align-items-center text-light ${
              isCollapsed ? 'justify-content-center px-2' : 'px-3'
            }`}
            onClick={handleLogout}
            title={isCollapsed ? "Cerrar Sesión" : ""}
            style={{
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease',
              minHeight: '48px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.15)';
              e.target.style.color = '#dc3545';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#f8f9fa';
            }}
          >
            <i className={`bi bi-door-open ${isCollapsed ? '' : 'me-3'}`} 
               style={{ fontSize: '1.2rem' }}></i>
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="flex-shrink-0 px-3 pb-2 text-center">
            <small className="text-muted" style={{ fontSize: "0.7rem" }}>
              AppsPark v1.0.0
            </small>
          </div>
        )}
      </div>

      {/* Overlay para móviles */}
      {!isCollapsed && window.innerWidth <= 768 && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark"
          style={{ zIndex: 1030, opacity: 0.5 }}
          onClick={() => setIsCollapsed(true)}
        ></div>
      )}

      <style jsx>{`
        @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css');
        
        .sidebar-collapsed {
          overflow: hidden;
        }
        
        .nav-link:not(.active):hover {
          transform: translateX(3px);
        }
        
        .nav-link.active {
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
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
        
        /* Custom scrollbar */
        nav::-webkit-scrollbar {
          width: 5px;
        }
        
        nav::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }
        
        nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
        }
        
        nav::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }

        /* Smooth transitions */
        * {
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        /* SweetAlert2 Custom Styles */
        .swal-dark-popup {
          border: 1px solid rgba(255,255,255,0.1);
        }

        .swal-confirm-btn {
          font-weight: 600;
          padding: 10px 24px;
        }

        .swal-cancel-btn {
          font-weight: 600;
          padding: 10px 24px;
        }
      `}</style>
    </>
  );
}
