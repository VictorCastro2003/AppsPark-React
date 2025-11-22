/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Sidebar from '../components/Sidebar';
import PublicidadBanner from '../components/PublicidadBanner';

export default function DetalleEstacionamiento() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [estacionamiento, setEstacionamiento] = useState(null);
  const [imagenConDetecciones, setImagenConDetecciones] = useState(null);
  const [reservasActivas, setReservasActivas] = useState(0);
  const [espaciosDetectadosYOLO, setEspaciosDetectadosYOLO] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingReservas, setIsLoadingReservas] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isCreatingManualReserva, setIsCreatingManualReserva] = useState(false);
  
  const [user] = useState({ username: "Usuario Demo" });
  
  useEffect(() => {
    let estacionamientoData = null;
    if (location.state?.estacionamientoData) {
      estacionamientoData = location.state.estacionamientoData;
    } else {
      estacionamientoData = {
        id: 1, nombre: "Estacionamiento Centro Comercial",
        direccion: "Av. Principal #123, Col. Centro",
        precio: 25.00, horario: "24 horas",
        espacios_disponibles: 45, espacios_total: 100
      };
    }
    setEstacionamiento(estacionamientoData);
    if (estacionamientoData) {
      cargarImagenYDeteccionYOLO(estacionamientoData.id);
      cargarReservasActivas(estacionamientoData.id);
    }
  }, [location.state]);

  const cargarImagenYDeteccionYOLO = async (estacionamientoId) => {
    setIsLoadingImage(true);
    setImageError(null);
    try {
      const response = await fetch('http://localhost:8000/detect/estacionamiento/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ estacionamiento_id: estacionamientoId })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.image_annotated) setImagenConDetecciones(data.image_annotated);
        if (data.available !== undefined) setEspaciosDetectadosYOLO(data.available);
      } else {
        setImageError(`Error del servidor: ${response.status}`);
      }
    } catch (error) {
      setImageError(`Error de conexión: ${error.message}`);
    } finally {
      setIsLoadingImage(false);
    }
  };

  const cargarReservasActivas = async (estacionamientoId) => {
    setIsLoadingReservas(true);
    try {
      const response = await fetch(`http://localhost:8000/reservas/activas/${estacionamientoId}`, {
        headers: {'Content-Type': 'application/json'}
      });
      if (response.ok) {
        const data = await response.json();
        setReservasActivas(data?.reservas_activas || 0);
      } else {
        setReservasActivas(0);
      }
    } catch (error) {
      setReservasActivas(0);
    } finally {
      setIsLoadingReservas(false);
    }
  };

  // NUEVA FUNCIÓN: Reserva manual para autos sin app
  const handleReservaManual = async () => {
    const { value: formValues } = await Swal.fire({
      title: '🚗 Reserva Manual',
      html: `
        <p class="text-muted mb-3">Registrar auto sin aplicación</p>
        <div class="mb-3">
          <label class="form-label">Placas del vehículo</label>
          <input id="swal-placas" class="swal2-input" placeholder="ABC-123-XY" style="width:80%">
        </div>
        <div class="mb-3">
          <label class="form-label">Descripción del vehículo</label>
          <input id="swal-descripcion" class="swal2-input" placeholder="Sedan rojo, Honda Civic" style="width:80%">
        </div>
        <div class="mb-3">
          <label class="form-label">Duración (horas)</label>
          <select id="swal-duracion" class="swal2-select" style="width:80%">
            <option value="1">1 hora</option>
            <option value="2">2 horas</option>
            <option value="3">3 horas</option>
            <option value="4">4 horas</option>
            <option value="8">8 horas (día parcial)</option>
            <option value="24">24 horas (día completo)</option>
          </select>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '✅ Crear Reserva',
      cancelButtonText: '❌ Cancelar',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      preConfirm: () => {
        const placas = document.getElementById('swal-placas').value.trim();
        const descripcion = document.getElementById('swal-descripcion').value.trim();
        const duracion = document.getElementById('swal-duracion').value;
        if (!placas) {
          Swal.showValidationMessage('Las placas son obligatorias');
          return false;
        }
        if (placas.length < 5) {
          Swal.showValidationMessage('Ingresa placas válidas');
          return false;
        }
        return { placas, descripcion, duracion };
      }
    });

    if (formValues) {
      setIsCreatingManualReserva(true);
      try {
        const response = await fetch('http://localhost:8000/reservas/manual/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            estacionamiento_id: estacionamiento.id,
            placas: formValues.placas,
            descripcion_vehiculo: formValues.descripcion,
            duracion_horas: parseInt(formValues.duracion)
          })
        });

        if (response.ok) {
          const data = await response.json();
          const costoTotal = (estacionamiento.precio * formValues.duracion).toFixed(2);
          await Swal.fire({
            icon: 'success',
            title: '¡Reserva Creada!',
            html: `
              <p><strong>Placas:</strong> ${formValues.placas}</p>
              <p><strong>Duración:</strong> ${formValues.duracion} hora(s)</p>
              <p><strong>Costo Total:</strong> $${costoTotal} MXN</p>
              ${data.codigo_reserva ? `<p><strong>Código:</strong> ${data.codigo_reserva}</p>` : ''}
            `,
            confirmButtonColor: '#28a745'
          });
          cargarReservasActivas(estacionamiento.id);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Error al crear reserva');
        }
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo crear la reserva',
          confirmButtonColor: '#dc3545'
        });
      } finally {
        setIsCreatingManualReserva(false);
      }
    }
  };

  const handleRefresh = () => {
    if (estacionamiento) {
      cargarImagenYDeteccionYOLO(estacionamiento.id);
      cargarReservasActivas(estacionamiento.id);
      Swal.fire({
        icon: 'info', title: 'Actualizando...', timer: 1500,
        showConfirmButton: false, timerProgressBar: true
      });
    }
  };

  const handleReserva = () => {
    navigate('/reservas_usuario', { state: { estacionamiento } });
  };

  const handleVerMapa = () => {
    if (estacionamiento?.direccion) {
      const direccionEncoded = encodeURIComponent(estacionamiento.direccion);
      window.open(`https://www.google.com/maps/search/${direccionEncoded}`, '_blank');
    } else {
      Swal.fire({
        icon: 'warning', title: 'Dirección no disponible',
        text: 'No se puede mostrar en el mapa',
        confirmButtonColor: '#ffc107'
      });
    }
  };

  const handleLogout = () => navigate('/');
  const handleGoBack = () => navigate('/home_usuario');

  const calcularEspaciosDisponibles = () => {
    if (!estacionamiento) return { disponibles: 0, total: 0, reservadas: 0, ocupados: 0 };
    const total = estacionamiento.espacios_total || 0;
    let libres = espaciosDetectadosYOLO ?? estacionamiento.espacios_disponibles ?? 0;
    const reservadas = reservasActivas || 0;
    const ocupados = Math.max(0, total - libres);
    const disponibles = Math.max(0, libres - reservadas);
    return { total, libres, reservadas, ocupados, disponibles, hayDeteccionYOLO: espaciosDetectadosYOLO !== null };
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
      
      <div className="flex-grow-1 bg-light d-flex flex-column">
        {/* Header */}
        <div className="bg-primary text-white p-4">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <button className="btn btn-outline-light me-3" onClick={handleGoBack}>
                  ← Volver
                </button>
                <div>
                  <h3 className="mb-0">{estacionamiento.nombre}</h3>
                  {espacios.hayDeteccionYOLO && (
                    <small className="badge bg-success mt-1">
                      <i className="fas fa-eye me-1"></i>Detección YOLO Activa
                    </small>
                  )}
                </div>
              </div>
              <button className="btn btn-outline-light" onClick={handleRefresh} title="Actualizar">
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container-fluid p-4 flex-grow-1">
          <div className="row">
            <div className="col-12">
              {/* Imagen */}
              <div className="card mb-4">
                <div className="card-body p-0">
                  <div 
                    className="position-relative bg-light d-flex align-items-center justify-content-center"
                    style={{ height: '300px', cursor: imagenConDetecciones ? 'pointer' : 'default' }}
                    onClick={() => imagenConDetecciones && setShowFullImage(true)}
                  >
                    {imagenConDetecciones ? (
                      <>
                        <img src={imagenConDetecciones} alt="Estacionamiento YOLO"
                          className="img-fluid h-100" style={{ objectFit: 'contain', maxHeight: '100%' }}/>
                        <div className="position-absolute badge bg-success" style={{ top: '12px', right: '12px', fontSize: '11px' }}>
                          <span className="bg-white rounded-circle me-2" style={{ width: '8px', height: '8px', display: 'inline-block' }}></span>
                          DETECCIÓN ACTIVA
                        </div>
                        <div className={`position-absolute px-3 py-1 rounded text-white fw-bold`}
                          style={{ bottom: '12px', left: '12px', backgroundColor: disponible ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)' }}>
                          {disponible ? `✅ Disponibles: ${espacios.disponibles}` : '⚠️ Completo'}
                        </div>
                        <div className="position-absolute bg-dark bg-opacity-75 text-white p-2 rounded"
                          style={{ bottom: '12px', right: '12px', fontSize: '10px' }}>
                          <span className="d-inline-flex align-items-center me-3">
                            <span className="bg-success rounded-circle me-1" style={{ width: '12px', height: '12px' }}></span>Libre
                          </span>
                          <span className="d-inline-flex align-items-center">
                            <span className="bg-danger rounded-circle me-1" style={{ width: '12px', height: '12px' }}></span>Ocupado
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted">
                        <div className="bg-white bg-opacity-75 rounded-circle p-3 d-inline-flex mb-3">
                          <div style={{ fontSize: '48px' }}>🅿️</div>
                        </div>
                        <div className="h5">{isLoadingImage ? 'Cargando detección...' : 'Imagen no disponible'}</div>
                        {isLoadingImage && <div className="spinner-border text-primary mt-2" role="status"></div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Alertas de estado */}
              {isLoadingImage && (
                <div className="alert alert-info d-flex align-items-center mb-3">
                  <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                  Detectando espacios disponibles...
                </div>
              )}

              {imageError && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center mb-3">
                  <span>Error en detección: {imageError}</span>
                  <button className="btn-close" onClick={() => setImageError(null)}></button>
                </div>
              )}

              <div className="row">
                {/* Info del estacionamiento */}
                <div className="col-md-6 mb-4">
                  <div className="card h-100">
                    <div className="card-header">
                      <h5 className="card-title mb-0">Información del Estacionamiento</h5>
                    </div>
                    <div className="card-body">
                      <h4 className="mb-3">{estacionamiento.nombre}</h4>
                      <div className="mb-3 d-flex align-items-start" style={{ cursor: 'pointer' }}
                        onClick={handleVerMapa} title="Click para abrir en Google Maps">
                        <span className="text-danger me-2">📍</span>
                        <span className="text-decoration-underline text-primary">{estacionamiento.direccion}</span>
                        <span className="ms-2 text-muted">🗺️</span>
                      </div>
                      <div className="mb-3 d-flex align-items-center">
                        <span className="text-success me-2">💰</span>
                        <span className="h5 text-success mb-0">${estacionamiento.precio.toFixed(2)} MXN/hora</span>
                      </div>
                      <div className="d-flex align-items-center">
                        <span className="text-primary me-2">🕒</span>
                        <span>{estacionamiento.horario}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disponibilidad */}
                <div className="col-md-6 mb-4">
                  <div className="card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h5 className="card-title mb-0">Disponibilidad</h5>
                      {isLoadingReservas && <div className="spinner-border spinner-border-sm" role="status"></div>}
                    </div>
                    <div className="card-body">
                      <div className={`alert ${disponible ? 'alert-success' : 'alert-danger'} d-flex align-items-center mb-3`}>
                        <span className="me-3" style={{ fontSize: '32px' }}>{disponible ? '✅' : '❌'}</span>
                        <div>
                          <div className="fw-bold">{disponible ? 'DISPONIBLE' : 'COMPLETO'}</div>
                          <div>{espacios.disponibles} espacios para reservar</div>
                          <small className="text-muted">{espacios.libres} libres, {espacios.reservadas} reservados</small>
                        </div>
                      </div>
                      <div className="row text-center">
                        <div className="col-3">
                          <div className="bg-primary bg-opacity-10 rounded p-2 mb-2"><div className="text-primary">🅿️</div></div>
                          <div className="fw-bold text-primary">{espacios.total}</div>
                          <small className="text-muted">Total</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-success bg-opacity-10 rounded p-2 mb-2"><div className="text-success">✅</div></div>
                          <div className="fw-bold text-success">{espacios.disponibles}</div>
                          <small className="text-muted">Reservar</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-warning bg-opacity-10 rounded p-2 mb-2"><div className="text-warning">📅</div></div>
                          <div className="fw-bold text-warning">{espacios.reservadas}</div>
                          <small className="text-muted">Reservados</small>
                        </div>
                        <div className="col-3">
                          <div className="bg-danger bg-opacity-10 rounded p-2 mb-2"><div className="text-danger">❌</div></div>
                          <div className="fw-bold text-danger">{espacios.ocupados}</div>
                          <small className="text-muted">Ocupados</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="row">
                <div className="col-12">
                  <div className="d-flex gap-3 justify-content-center flex-wrap">
                    <button className={`btn ${disponible ? 'btn-success' : 'btn-secondary'} btn-lg px-4`}
                      onClick={handleReserva} disabled={!disponible}>
                      📅 {disponible ? 'Hacer Reserva' : 'No Disponible'}
                    </button>
                    
                    {/* BOTÓN RESERVA MANUAL - Solo visible si hay espacio */}
                    {disponible && (
                      <button 
                        className="btn btn-warning btn-lg px-4"
                        onClick={handleReservaManual}
                        disabled={isCreatingManualReserva}
                        title="Registrar auto que no tiene la aplicación"
                      >
                        {isCreatingManualReserva ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Procesando...
                          </>
                        ) : (
                          <>🚗 Reserva Manual</>
                        )}
                      </button>
                    )}
                    
                    <button className="btn btn-outline-primary btn-lg px-4" onClick={handleVerMapa}>
                      🗺️ Google Maps
                    </button>
                  </div>

                  {disponible && (
                    <div className="text-center mt-3">
                      <small className="text-muted">
                        💡 Usa "Reserva Manual" para registrar autos que no tienen la aplicación
                      </small>
                    </div>
                  )}

                  {!disponible && (
                    <div className="text-center mt-3">
                      <small className="text-muted">
                        Todos los espacios están ocupados o reservados. Intenta actualizar o vuelve más tarde.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMPONENTE DE PUBLICIDAD */}
        <PublicidadBanner />
      </div>

      {/* Modal imagen completa */}
      {showFullImage && imagenConDetecciones && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setShowFullImage(false)}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content bg-transparent border-0">
              <div className="modal-body p-0 position-relative">
                <button className="btn btn-outline-light position-absolute"
                  style={{ top: '10px', right: '10px', zIndex: 1000 }}
                  onClick={() => setShowFullImage(false)}>✕</button>
                <img src={imagenConDetecciones} alt="Imagen completa"
                  className="img-fluid w-100" style={{ maxHeight: '90vh', objectFit: 'contain' }}/>
                <div className="position-absolute bottom-0 start-0 m-3 text-white">
                  <h5>{estacionamiento.nombre}</h5>
                  <p className="mb-0">{espacios.disponibles} espacios disponibles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}