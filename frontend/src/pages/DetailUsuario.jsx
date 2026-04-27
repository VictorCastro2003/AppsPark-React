/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Sidebar from '../components/Sidebar';
import PublicidadBanner from '../components/PublicidadBanner';

const API_URL = "http://localhost:8000";

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
  const [zonas, setZonas] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => new Date().toISOString().split('T')[0]);
  const [horaInicioSel, setHoraInicioSel] = useState("");
  const [horaFinSel, setHoraFinSel] = useState("");
  const [reservasFecha, setReservasFecha] = useState([]);
  const [isLoadingReservasFecha, setIsLoadingReservasFecha] = useState(false);
  const [selectedCajonId, setSelectedCajonId] = useState(null);
  
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
        if (data.zones && Array.isArray(data.zones)) setZonas(data.zones);
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

  const cargarReservasPorFecha = async (estacionamientoId, fecha, horaInicio, horaFin) => {
    if (!fecha) {
      setReservasFecha([]);
      return;
    }
    setIsLoadingReservasFecha(true);
    try {
      const params = new URLSearchParams({ fecha });
      if (horaInicio && horaFin) {
        params.append("hora_inicio", horaInicio);
        params.append("hora_fin", horaFin);
      }
      const response = await fetch(
        `${API_URL}/reservas/estacionamiento/${estacionamientoId}?${params.toString()}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        setReservasFecha(Array.isArray(data) ? data : []);
      } else {
        setReservasFecha([]);
      }
    } catch (error) {
      setReservasFecha([]);
    } finally {
      setIsLoadingReservasFecha(false);
    }
  };

  useEffect(() => {
    if (estacionamiento?.id && fechaSeleccionada) {
      cargarReservasPorFecha(estacionamiento.id, fechaSeleccionada, horaInicioSel, horaFinSel);
    }
  }, [estacionamiento, fechaSeleccionada, horaInicioSel, horaFinSel]);

  useEffect(() => {
    if (!selectedCajonId) return;
    const reservedIds = new Set(
      (reservasFecha || [])
        .map((r) => {
          const key = r.cajon_numero ?? r.cajon_id;
          const num = parseInt(key, 10);
          return Number.isFinite(num) ? num : null;
        })
        .filter((v) => v !== null)
    );
    const selectedZone = (zonas || []).find(z => z.id === selectedCajonId);
    if (selectedZone?.occupied || reservedIds.has(selectedCajonId)) {
      setSelectedCajonId(null);
    }
  }, [zonas, reservasFecha, selectedCajonId]);

  const handleRefresh = () => {
    if (estacionamiento) {
      cargarImagenYDeteccionYOLO(estacionamiento.id);
      cargarReservasActivas(estacionamiento.id);
      cargarReservasPorFecha(estacionamiento.id, fechaSeleccionada, horaInicioSel, horaFinSel);
      Swal.fire({
        icon: 'info', title: 'Actualizando...', timer: 1500,
        showConfirmButton: false, timerProgressBar: true
      });
    }
  };

  const handleReserva = () => {
    if (!selectedCajonId || !fechaSeleccionada || !horaInicioSel || !horaFinSel) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un espacio',
        text: 'Elige fecha, horario y un espacio disponible antes de continuar.',
        confirmButtonColor: '#0d6efd'
      });
      return;
    }
    if (new Date(`${fechaSeleccionada}T${horaInicioSel}`) >= new Date(`${fechaSeleccionada}T${horaFinSel}`)) {
      Swal.fire({
        icon: 'warning',
        title: 'Horario inválido',
        text: 'La hora de fin debe ser posterior a la hora de inicio.',
        confirmButtonColor: '#0d6efd'
      });
      return;
    }
    navigate('/reservas_usuario', { 
      state: { 
        estacionamiento,
        selectedCajonId,
        fechaReserva: fechaSeleccionada,
        horaInicio: horaInicioSel,
        horaFin: horaFinSel
      } 
    });
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
  const horarioValido = fechaSeleccionada && horaInicioSel && horaFinSel &&
    new Date(`${fechaSeleccionada}T${horaInicioSel}`) < new Date(`${fechaSeleccionada}T${horaFinSel}`);
  const puedeReservar = disponible && selectedCajonId && horarioValido;
  const getCajonKey = (r) => {
    const key = r.cajon_numero ?? r.cajon_id;
    const num = parseInt(key, 10);
    return Number.isFinite(num) ? num : null;
  };
  const reservedIds = new Set(
    (reservasFecha || [])
      .map(getCajonKey)
      .filter((v) => v !== null)
  );
  const reservasByCajon = new Map(
    (reservasFecha || [])
      .map((r) => [getCajonKey(r), r])
      .filter(([k]) => k !== null)
  );
  const formatTime = (t) => {
    if (!t) return "";
    return typeof t === "string" ? t.slice(0, 5) : String(t).slice(0, 5);
  };
  const getZoneStatus = (zone) => {
    if (zone.occupied) return "occupied";
    if (reservedIds.has(zone.id)) return "reserved";
    return "free";
  };

  return (
    <div className="d-flex min-vh-100">
      <Sidebar user={user} onLogout={handleLogout} currentPage="buscar" />
      
      <div className="flex-grow-1 d-flex flex-column ap-page" style={{ backgroundColor: '#f5f7fb' }}>
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

              {/* Selector de espacios */}
              <div className="row">
                <div className="col-12 mb-4">
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h5 className="card-title mb-0">Selecciona un espacio</h5>
                      {isLoadingReservasFecha && <div className="spinner-border spinner-border-sm" role="status"></div>}
                    </div>
                    <div className="card-body">
                      <div className="row g-3 mb-3">
                        <div className="col-md-4">
                          <label className="form-label">Fecha</label>
                          <input
                            type="date"
                            className="form-control"
                            value={fechaSeleccionada}
                            onChange={(e) => setFechaSeleccionada(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Hora inicio</label>
                          <input
                            type="time"
                            className="form-control"
                            value={horaInicioSel}
                            onChange={(e) => setHoraInicioSel(e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Hora fin</label>
                          <input
                            type="time"
                            className="form-control"
                            value={horaFinSel}
                            onChange={(e) => setHoraFinSel(e.target.value)}
                          />
                        </div>
                      </div>

                      {zonas && zonas.length > 0 ? (
                        <>
                          <div className="parking-grid">
                            {zonas.map((zone) => {
                              const status = getZoneStatus(zone);
                              const isSelected = selectedCajonId === zone.id;
                              const isDisabled = status !== "free";
                              const reservaInfo = reservasByCajon.get(zone.id);
                              const tooltip =
                                status === "reserved"
                                  ? `Reservado: ${reservaInfo?.usuario_nombre || `Usuario ${reservaInfo?.usuario_id || ""}`}. ${formatTime(reservaInfo?.hora_inicio)}-${formatTime(reservaInfo?.hora_fin)}`
                                  : status === "occupied"
                                  ? "Ocupado fisico"
                                  : "Libre";
                              return (
                                <button
                                  key={zone.id}
                                  type="button"
                                  className={`parking-slot ${status} ${isSelected ? "selected" : ""}`}
                                  aria-disabled={isDisabled}
                                  onClick={() => {
                                    if (!isDisabled) setSelectedCajonId(zone.id);
                                  }}
                                  data-tooltip={`Espacio ${zone.id} - ${tooltip}`}
                                >
                                  {zone.id}
                                </button>
                              );
                            })}
                          </div>
                          <div className="d-flex flex-wrap gap-3 mt-3 small text-muted">
                            <span className="d-flex align-items-center gap-2">
                              <span className="legend-box free"></span>Libre
                            </span>
                            <span className="d-flex align-items-center gap-2">
                              <span className="legend-box reserved"></span>Reservado (solo en esta fecha)
                            </span>
                            <span className="d-flex align-items-center gap-2">
                              <span className="legend-box occupied"></span>Ocupado
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="alert alert-warning mb-0">
                          No hay zonas configuradas para este estacionamiento.
                        </div>
                      )}

                      {selectedCajonId && (
                        <div className="alert alert-info mt-3 mb-0">
                          Espacio seleccionado: <strong>#{selectedCajonId}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="row">
                <div className="col-12">
                  <div className="d-flex gap-3 justify-content-center flex-wrap">
                    <button className={`btn ${puedeReservar ? 'btn-success' : 'btn-secondary'} btn-lg px-4`}
                      onClick={handleReserva} disabled={!puedeReservar}>
                      📅 {puedeReservar ? 'Hacer Reserva' : 'Completa la seleccion'}
                    </button>
                    
                    <button className="btn btn-outline-primary btn-lg px-4" onClick={handleVerMapa}>
                      🗺️ Google Maps
                    </button>
                  </div>

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

      <style>{`
        .parking-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
          gap: 10px;
          background: linear-gradient(180deg, rgba(248,249,255,0.9), rgba(255,255,255,0.95));
          border-radius: 12px;
          padding: 12px;
          border: 1px solid #e5e7ff;
        }
        .parking-slot {
          border: 2px solid transparent;
          border-radius: 10px;
          height: 56px;
          font-weight: 600;
          background: #f1f3f5;
          color: #343a40;
          transition: transform 0.12s ease, box-shadow 0.2s ease, filter 0.2s ease;
          position: relative;
        }
        .parking-slot.free {
          background: #e9f7ef;
          border-color: #28a745;
          color: #1e7e34;
        }
        .parking-slot.free:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 18px rgba(40, 167, 69, 0.2);
        }
        .parking-slot.reserved {
          background: #fff3e0;
          border-color: #fd7e14;
          color: #b45309;
          filter: saturate(0.9);
        }
        .parking-slot.occupied {
          background: #fdecea;
          border-color: #dc3545;
          color: #b02a37;
          cursor: not-allowed;
          filter: grayscale(0.1);
        }
        .parking-slot[aria-disabled="true"] {
          cursor: not-allowed;
        }
        .parking-slot[data-tooltip]:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          left: 50%;
          bottom: calc(100% + 8px);
          transform: translateX(-50%);
          background: rgba(17, 24, 39, 0.95);
          color: #fff;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10;
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .parking-slot[data-tooltip]:hover::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: calc(100% + 2px);
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(17, 24, 39, 0.95);
          z-index: 9;
        }
        .parking-slot.selected {
          box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.35);
          transform: translateY(-1px);
        }
        .legend-box {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          display: inline-block;
          border: 2px solid transparent;
        }
        .legend-box.free { background: #e9f7ef; border-color: #28a745; }
        .legend-box.reserved { background: #fff3e0; border-color: #fd7e14; }
        .legend-box.occupied { background: #fdecea; border-color: #dc3545; }
        .ap-page .card {
          border-radius: 14px;
          border: 1px solid #e9ecef;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .ap-page .card-header {
          background: linear-gradient(135deg, #eef2ff, #ffffff);
          border-bottom: 1px solid #e9ecef;
        }
        .ap-page .btn-primary {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          border: none;
        }
      `}</style>
    </div>
  );
}
