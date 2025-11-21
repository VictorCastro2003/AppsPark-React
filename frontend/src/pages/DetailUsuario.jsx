/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function DetalleEstacionamiento() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados principales
  const [estacionamiento, setEstacionamiento] = useState(null);
  const [imagenConDetecciones, setImagenConDetecciones] = useState(null);
  const [reservasActivas, setReservasActivas] = useState(0);
  const [espaciosDetectadosYOLO, setEspaciosDetectadosYOLO] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingReservas, setIsLoadingReservas] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);
  
  // Usuario simulado (en producción vendría del contexto/estado global)
  const [user] = useState({ username: "Usuario Demo" });
  
  // Obtener datos del estacionamiento desde location.state o usar datos mock
  useEffect(() => {
    let estacionamientoData = null;
    
    // Intentar obtener datos de la navegación
    if (location.state?.estacionamientoData) {
      estacionamientoData = location.state.estacionamientoData;
      console.log('🔍 Datos recibidos desde navegación:', estacionamientoData);
    } else {
      // Datos de ejemplo si no hay navegación (acceso directo)
      console.log('⚠️ No hay datos de navegación, usando datos mock');
      estacionamientoData = {
        id: 1,
        nombre: "Estacionamiento Centro Comercial",
        direccion: "Av. Principal #123, Col. Centro",
        precio: 25.00,
        horario: "24 horas",
        espacios_disponibles: 45,
        espacios_total: 100
      };
    }
    
    setEstacionamiento(estacionamientoData);
    
    // Cargar imagen YOLO y reservas
    if (estacionamientoData) {
      cargarImagenYDeteccionYOLO(estacionamientoData.id);
      cargarReservasActivas(estacionamientoData.id);
    }
  }, [location.state]);

  // Función para cargar imagen y detección YOLO
  const cargarImagenYDeteccionYOLO = async (estacionamientoId) => {
    setIsLoadingImage(true);
    setImageError(null);

    try {
      console.log('🔄 Cargando detección YOLO para estacionamiento:', estacionamientoId);
      
     const response = await fetch('http://localhost:8000/detect/estacionamiento/', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ estacionamiento_id: estacionamientoId }) // ✅ CORRECTO
});

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Respuesta YOLO:', data);
        
        // Guardar imagen anotada
        if (data.image_annotated) {
          setImagenConDetecciones(data.image_annotated);
        }
        
        // Guardar espacios detectados por YOLO
        if (data.available !== undefined) {
          setEspaciosDetectadosYOLO(data.available);
          console.log('✅ YOLO detectó:', data.available, 'espacios libres');
        }
        
        // Si hay estadísticas adicionales
        if (data.statistics) {
          console.log('📊 Estadísticas YOLO:', data.statistics);
        }
        
      } else {
        const errorText = `Error del servidor: ${response.status}`;
        setImageError(errorText);
        console.error('❌ Error en detección YOLO:', response.status);
      }
    } catch (error) {
      const errorText = `Error de conexión: ${error.message}`;
      setImageError(errorText);
      console.error('❌ Error cargando YOLO:', error);
    } finally {
      setIsLoadingImage(false);
    }
  };

  // Función para cargar reservas activas
  const cargarReservasActivas = async (estacionamientoId) => {
    setIsLoadingReservas(true);

    try {
      console.log('\n🔍 === DEBUG RESERVAS ACTIVAS (USUARIO) ===');
      console.log('🏢 ID del estacionamiento:', estacionamientoId);
      
      const response = await fetch(`http://localhost:8000/reservas/activas/${estacionamientoId}`, {
        headers: {'Content-Type': 'application/json'}
      });

      console.log('📡 Status code:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📄 Response data:', data);
        
        let reservasActivasCount = 0;
        if (data && typeof data === 'object') {
          reservasActivasCount = data.reservas_activas || 0;
          
          if (data.debug_info) {
            console.log('🛠 Debug info del servidor:', data.debug_info);
          }
        }
        
        console.log('✅ Reservas activas obtenidas:', reservasActivasCount);
        setReservasActivas(reservasActivasCount);
        
      } else if (response.status === 404) {
        console.log('ℹ️ No hay reservas activas (404 es normal)');
        setReservasActivas(0);
      } else {
        console.error('❌ Error HTTP:', response.status);
        setReservasActivas(0);
      }
    } catch (error) {
      console.error('❌ Excepción al cargar reservas:', error);
      setReservasActivas(0);
    } finally {
      setIsLoadingReservas(false);
      console.log('=== FIN DEBUG RESERVAS ACTIVAS ===\n');
    }
  };

  const handleRefresh = () => {
    if (estacionamiento) {
      cargarImagenYDeteccionYOLO(estacionamiento.id);
      cargarReservasActivas(estacionamiento.id);
    }
  };

  const handleReserva = () => {
    navigate('/reservas_usuario', { state: { estacionamiento } });
  };

  const handleVerMapa = () => {
    if (estacionamiento?.direccion) {
      const direccionEncoded = encodeURIComponent(estacionamiento.direccion);
      const googleMapsUrl = `https://www.google.com/maps/search/${direccionEncoded}`;
      window.open(googleMapsUrl, '_blank');
    } else {
      alert('Dirección no disponible para mostrar en el mapa');
    }
  };

  const handleDireccionClick = () => {
    handleVerMapa();
  };

  const handleLogout = () => {
    // Navegar al login o página principal
    navigate('/');
  };

  const handleGoBack = () => {
    // Navegar de vuelta a la búsqueda
    navigate('/home_usuario');
  };

  // Función para calcular espacios disponibles
  const calcularEspaciosDisponibles = () => {
    if (!estacionamiento) return { disponibles: 0, total: 0, reservadas: 0, ocupados: 0 };
    
    const total = estacionamiento.espacios_total || 0;
    let espaciosLibresFisicos = estacionamiento.espacios_disponibles || 0;
    
    // Si YOLO detectó espacios, usar esa información
    if (espaciosDetectadosYOLO !== null) {
      espaciosLibresFisicos = espaciosDetectadosYOLO;
    }
    
    const reservadas = reservasActivas || 0;
    const ocupadosFisicamente = Math.max(0, total - espaciosLibresFisicos);
    
    // Espacios realmente disponibles para reservar
    const disponiblesParaReservar = Math.max(0, espaciosLibresFisicos - reservadas);
    
    return {
      total,
      libres: espaciosLibresFisicos,
      reservadas,
      ocupados: ocupadosFisicamente,
      disponibles: disponiblesParaReservar,
      hayDeteccionYOLO: espaciosDetectadosYOLO !== null
    };
  };

  if (!estacionamiento) {
    return (
      <div className="d-flex">
        <Sidebar user={user} onLogout={handleLogout} currentPage="buscar" />
        <div className="flex-grow-1 d-flex justify-content-center align-items-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  const espacios = calcularEspaciosDisponibles();
  const disponible = espacios.disponibles > 0;

  return (
    <div className="d-flex min-vh-100">
      <Sidebar user={user} onLogout={handleLogout} currentPage="buscar" />
      
      <div className="flex-grow-1 bg-light">
        {/* Header */}
        <div className="bg-primary text-white p-4">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <button 
                  className="btn btn-outline-light me-3"
                  onClick={handleGoBack}
                >
                  ← Volver
                </button>
                <div>
                  <h3 className="mb-0">{estacionamiento.nombre}</h3>
                  {espacios.hayDeteccionYOLO && (
                    <small className="badge bg-success mt-1">
                      <i className="fas fa-eye me-1"></i>
                      Detección YOLO Activa
                    </small>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-outline-light"
                onClick={handleRefresh}
                title="Actualizar información"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container-fluid p-4">
          <div className="row">
            <div className="col-12">
              {/* Imagen del estacionamiento */}
              <div className="card mb-4">
                <div className="card-body p-0">
                  <div 
                    className="position-relative bg-light d-flex align-items-center justify-content-center"
                    style={{ height: '300px', cursor: imagenConDetecciones ? 'pointer' : 'default' }}
                    onClick={() => imagenConDetecciones && setShowFullImage(true)}
                  >
                    {imagenConDetecciones ? (
                      <>
                        <img 
                          src={imagenConDetecciones}
                          alt="Estacionamiento con detecciones YOLO"
                          className="img-fluid h-100"
                          style={{ objectFit: 'contain', maxHeight: '100%' }}
                        />
                        
                        {/* Badge YOLO */}
                        <div 
                          className="position-absolute badge bg-success d-flex align-items-center"
                          style={{ top: '12px', right: '12px', fontSize: '11px' }}
                        >
                          <span className="bg-white rounded-circle me-2" style={{ width: '8px', height: '8px' }}></span>
                          DETECCIÓN ACTIVA
                        </div>
                        
                        {/* Badge de espacios disponibles */}
                        <div 
                          className={`position-absolute px-3 py-1 rounded text-white fw-bold`}
                          style={{ 
                            bottom: '12px', 
                            left: '12px',
                            backgroundColor: espacios.disponibles > 0 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)'
                          }}
                        >
                          {espacios.disponibles > 0 ? `✅ Disponibles: ${espacios.disponibles}` : '⚠️ Completo'}
                        </div>
                        
                        {/* Leyenda de colores */}
                        <div 
                          className="position-absolute bg-dark bg-opacity-75 text-white p-2 rounded"
                          style={{ bottom: '12px', right: '12px', fontSize: '10px' }}
                        >
                          <span className="d-inline-flex align-items-center me-3">
                            <span className="bg-success rounded-circle me-1" style={{ width: '12px', height: '12px' }}></span>
                            Libre
                          </span>
                          <span className="d-inline-flex align-items-center">
                            <span className="bg-danger rounded-circle me-1" style={{ width: '12px', height: '12px' }}></span>
                            Ocupado
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted">
                        <div className="bg-white bg-opacity-75 rounded-circle p-3 d-inline-flex mb-3">
                          <div style={{ fontSize: '48px' }}>🅿️</div>
                        </div>
                        <div className="h5">
                          {isLoadingImage ? 'Cargando detección...' : 'Imagen no disponible'}
                        </div>
                        {isLoadingImage && (
                          <div className="spinner-border text-primary mt-2" role="status">
                            <span className="visually-hidden">Cargando...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Estados de carga */}
              {isLoadingImage && (
                <div className="alert alert-info d-flex align-items-center mb-3">
                  <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                  Detectando espacios disponibles...
                </div>
              )}

              {imageError && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center mb-3">
                  <span>Error en detección: {imageError}</span>
                  <button 
                    className="btn-close"
                    onClick={() => setImageError(null)}
                    aria-label="Close"
                  ></button>
                </div>
              )}

              <div className="row">
                {/* Información básica */}
                <div className="col-md-6 mb-4">
                  <div className="card h-100">
                    <div className="card-header">
                      <h5 className="card-title mb-0">Información del Estacionamiento</h5>
                    </div>
                    <div className="card-body">
                      <h4 className="mb-3">{estacionamiento.nombre}</h4>
                      
                      {/* DIRECCIÓN CLICKEABLE PARA GOOGLE MAPS */}
                      <div 
                        className="mb-3 d-flex align-items-start"
                        style={{ cursor: 'pointer' }}
                        onClick={handleDireccionClick}
                        title="Click para abrir en Google Maps"
                      >
                        <span className="text-danger me-2">📍</span>
                        <span className="text-decoration-underline text-primary">
                          {estacionamiento.direccion}
                        </span>
                        <span className="ms-2 text-muted">🗺️</span>
                      </div>
                      
                      <div className="mb-3 d-flex align-items-center">
                        <span className="text-success me-2">💰</span>
                        <span className="h5 text-success mb-0">
                          ${estacionamiento.precio.toFixed(2)} MXN por hora
                        </span>
                      </div>
                      
                      <div className="d-flex align-items-center">
                        <span className="text-primary me-2">🕒</span>
                        <span>{estacionamiento.horario}</span>
                      </div>

                      {/* Información de detección */}
                      {espacios.hayDeteccionYOLO && (
                        <div className="mt-3 p-2 bg-success-subtle rounded">
                          <small className="text-success">
                            <i className="fas fa-robot me-1"></i>
                            Información actualizada con detección automática
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Disponibilidad */}
                <div className="col-md-6 mb-4">
                  <div className="card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h5 className="card-title mb-0">Disponibilidad</h5>
                      {isLoadingReservas && (
                        <div className="spinner-border spinner-border-sm" role="status"></div>
                      )}
                    </div>
                    <div className="card-body">
                      {/* Estado de disponibilidad */}
                      <div className={`alert ${disponible ? 'alert-success' : 'alert-danger'} d-flex align-items-center mb-3`}>
                        <span className="me-3" style={{ fontSize: '32px' }}>
                          {disponible ? '✅' : '❌'}
                        </span>
                        <div>
                          <div className="fw-bold">
                            {disponible ? 'DISPONIBLE' : 'COMPLETO'}
                          </div>
                          <div>
                            {espacios.disponibles} espacios disponibles para reservar
                          </div>
                          <small className="text-muted">
                            {espacios.libres} libres físicamente, {espacios.reservadas} ya reservados
                          </small>
                        </div>
                      </div>

                      {/* Resumen de espacios */}
                      <div className="row text-center">
                        <div className="col-3">
                          <div className="bg-primary bg-opacity-10 rounded p-2 mb-2">
                            <div className="text-primary">🅿️</div>
                          </div>
                          <div className="fw-bold text-primary">{espacios.total}</div>
                          <small className="text-muted">Total</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-success bg-opacity-10 rounded p-2 mb-2">
                            <div className="text-success">✅</div>
                          </div>
                          <div className="fw-bold text-success">{espacios.disponibles}</div>
                          <small className="text-muted">Para reservar</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-warning bg-opacity-10 rounded p-2 mb-2">
                            <div className="text-warning">📅</div>
                          </div>
                          <div className="fw-bold text-warning">{espacios.reservadas}</div>
                          <small className="text-muted">Reservados</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-danger bg-opacity-10 rounded p-2 mb-2">
                            <div className="text-danger">❌</div>
                          </div>
                          <div className="fw-bold text-danger">{espacios.ocupados}</div>
                          <small className="text-muted">Ocupados</small>
                        </div>
                      </div>

                      {/* Información adicional de detección */}
                      {espacios.hayDeteccionYOLO && (
                        <div className="mt-3 p-2 bg-info-subtle rounded">
                          <small className="text-info">
                            <i className="fas fa-info-circle me-1"></i>
                            Datos actualizados en tiempo real
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="row">
                <div className="col-12">
                  <div className="d-flex gap-3 justify-content-center">
                    <button 
                      className={`btn ${disponible ? 'btn-success' : 'btn-secondary'} btn-lg px-4`}
                      onClick={handleReserva}
                      disabled={!disponible}
                    >
                      📅 {disponible ? 'Hacer Reserva' : 'No Disponible'}
                    </button>
                    <button 
                      className="btn btn-outline-primary btn-lg px-4"
                      onClick={handleVerMapa}
                      title={`Abrir ${estacionamiento.direccion} en Google Maps`}
                    >
                      🗺️ Abrir en Google Maps
                    </button>
                  </div>

                  {/* Mensaje informativo si no hay espacios */}
                  {!disponible && (
                    <div className="text-center mt-3">
                      <small className="text-muted">
                        Todos los espacios están ocupados o reservados. 
                        Intenta actualizar la información o vuelve más tarde.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para imagen completa */}
      {showFullImage && imagenConDetecciones && (
        <div 
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setShowFullImage(false)}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content bg-transparent border-0">
              <div className="modal-body p-0 position-relative">
                <button
                  className="btn btn-outline-light position-absolute"
                  style={{ top: '10px', right: '10px', zIndex: 1000 }}
                  onClick={() => setShowFullImage(false)}
                >
                  ✕
                </button>
                <img 
                  src={imagenConDetecciones}
                  alt="Imagen completa del estacionamiento"
                  className="img-fluid w-100"
                  style={{ maxHeight: '90vh', objectFit: 'contain' }}
                />
                <div className="position-absolute bottom-0 start-0 m-3 text-white">
                  <h5>{estacionamiento.nombre}</h5>
                  <p className="mb-0">Detección automática - {espacios.disponibles} espacios disponibles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}