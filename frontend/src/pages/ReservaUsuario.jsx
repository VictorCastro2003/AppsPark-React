/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import PublicidadBanner from "../components/PublicidadBanner";
import PaymentModal from "../components/PaymentModal";


const API_URL = "http://localhost:8000";

export default function ReservaUsuario() {
  const navigate = useNavigate();
  const location = useLocation();

  // Datos del estacionamiento pasados desde el router
  const estacionamiento = location.state?.estacionamiento;

  // Estados del formulario
  const [placaVehiculo, setPlacaVehiculo] = useState("");
  const [fechaReserva, setFechaReserva] = useState(location.state?.fechaReserva || "");
  const [horaInicio, setHoraInicio] = useState(location.state?.horaInicio || "");
  const [horaFin, setHoraFin] = useState(location.state?.horaFin || "");
  const [selectedCajonId, setSelectedCajonId] = useState(location.state?.selectedCajonId ?? null);
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false); // Anti doble-click
  const [estacionamientoActual, setEstacionamientoActual] = useState(estacionamiento);
  const [user] = useState({ username: "Usuario" }); // Simular usuario logueado
  const [zonas, setZonas] = useState([]);
  const [reservasFecha, setReservasFecha] = useState([]);
  const [isLoadingReservasFecha, setIsLoadingReservasFecha] = useState(false);
  const [isLoadingZonas, setIsLoadingZonas] = useState(false);
  // Estado del modal de pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reservaCreada, setReservaCreada] = useState(null); // { id, monto }


  // Validación mejorada
  const puedeReservar = 
    placaVehiculo.trim() !== "" && 
    fechaReserva && 
    horaInicio && 
    horaFin &&
    !loading &&
    !submitting &&
    new Date(`${fechaReserva}T${horaInicio}`) < new Date(`${fechaReserva}T${horaFin}`) &&
    estacionamientoActual?.espacios_disponibles > 0 &&
    selectedCajonId;


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

  // Cargar datos actuales del estacionamiento
  useEffect(() => {
    if (estacionamiento?.id) {
      cargarEstacionamientoActual();
    }
  }, [estacionamiento]);

  useEffect(() => {
    if (estacionamiento?.id) {
      cargarZonas();
    }
  }, [estacionamiento]);

  useEffect(() => {
    cargarReservasPorFecha();
  }, [estacionamiento?.id, fechaReserva, horaInicio, horaFin]);

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

  const cargarEstacionamientoActual = async () => {
    try {
      const response = await fetch(`${API_URL}/estacionamientos/${estacionamiento.id}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setEstacionamientoActual(data);
    } catch (error) {
      console.error("Error cargando estacionamiento:", error);
      setMensaje({ 
        tipo: "warning", 
        texto: "No se pudieron cargar los datos actuales del estacionamiento" 
      });
    }
  };

  const cargarZonas = async () => {
    if (!estacionamiento?.id) return;
    setIsLoadingZonas(true);
    try {
      const response = await fetch(`${API_URL}/detect/estacionamiento/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estacionamiento_id: estacionamiento.id })
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.zones)) setZonas(data.zones);
      }
    } catch (error) {
      setZonas([]);
    } finally {
      setIsLoadingZonas(false);
    }
  };

  const cargarReservasPorFecha = async () => {
    if (!estacionamiento?.id || !fechaReserva) {
      setReservasFecha([]);
      return;
    }
    setIsLoadingReservasFecha(true);
    try {
      const params = new URLSearchParams({ fecha: fechaReserva });
      if (horaInicio && horaFin) {
        params.append("hora_inicio", horaInicio);
        params.append("hora_fin", horaFin);
      }
      const response = await fetch(
        `${API_URL}/reservas/estacionamiento/${estacionamiento.id}?${params.toString()}`
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

  const confirmarReserva = async (e) => {
    e.preventDefault();
    // Prevenir doble submit
    if (submitting || loading) return;
    setSubmitting(true);
    setLoading(true);
    setMensaje(null);

    try {
      const reservaData = {
        estacionamiento_id: estacionamiento.id,
        usuario_id: 1, // Reemplazar con el ID del usuario logueado
        cajon_id: selectedCajonId,
        placa_vehiculo: placaVehiculo,
        fecha_reserva: fechaReserva,
        hora_inicio: horaInicio,
        hora_fin: horaFin
      };

      const response = await fetch(`${API_URL}/reservas/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reservaData)
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje({ 
          tipo: "success", 
          texto: `✅ Reserva #${data.reserva_id} creada. Completa el pago para confirmarla.`
        });
        // Calcular monto para mostrar en el modal de pago
        const inicio = new Date(`2000-01-01T${horaInicio}`);
        const fin = new Date(`2000-01-01T${horaFin}`);
        const horas = Math.max(0, (fin - inicio) / (1000 * 60 * 60));
        const montoCalculado = (horas * (estacionamientoActual?.precio || 0)).toFixed(2);
        // Guardar datos de la reserva creada y abrir modal de pago
        setReservaCreada({ id: data.reserva_id, monto: montoCalculado });
        setShowPaymentModal(true);
      } else {
        throw new Error(data.detail || 'Error al crear la reserva');
      }
    } catch (error) {
      console.error("Error creando reserva:", error);
      
      let mensajeError = "❌ Error al crear la reserva";
      
      if (error.message.includes('detail')) {
        mensajeError = `❌ ${error.message}`;
      } else if (error.message.includes('400')) {
        mensajeError = "❌ Datos de reserva inválidos";
      } else if (error.message.includes('404')) {
        mensajeError = "❌ Estacionamiento no encontrado";
      } else {
        mensajeError = `❌ ${error.message}`;
      }
      
      setMensaje({ tipo: "danger", texto: mensajeError });
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };


  const calcularDuracion = () => {
    if (horaInicio && horaFin) {
      const inicio = new Date(`2000-01-01T${horaInicio}`);
      const fin = new Date(`2000-01-01T${horaFin}`);
      
      if (fin > inicio) {
        const diffMs = fin - inicio;
        const diffHrs = diffMs / (1000 * 60 * 60);
        return diffHrs;
      }
    }
    return 0;
  };

  const calcularPrecioTotal = () => {
    const duracion = calcularDuracion();
    return (duracion * (estacionamientoActual?.precio || 0)).toFixed(2);
  };

  const handleLogout = () => {
    alert("Sesión cerrada");
    navigate('/login');
  };

  // Verificar que tenemos datos del estacionamiento
  if (!estacionamiento) {
    return (
      <div className="d-flex" style={{ minHeight: "100vh" }}>
        <Sidebar user={user} onLogout={handleLogout} currentPage="reservar" />
        
        <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="container mt-4">
            <div className="alert alert-danger">
              <h4 className="alert-heading">Error</h4>
              <p>No se encontraron datos del estacionamiento. Por favor, regresa a la búsqueda.</p>
              <button 
                className="btn btn-outline-danger" 
                onClick={() => navigate("/Home_Usuario")}
              >
                Volver a Búsqueda
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      <Sidebar user={user} onLogout={handleLogout} currentPage="reservar" />
      
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="container mt-4">
          <div className="row justify-content-center">
            <div className="col-md-8">
              {/* Header */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="mb-1">Reserva en {estacionamientoActual?.nombre || estacionamiento.nombre}</h2>
                  <p className="text-muted mb-0">Completa los datos para tu reserva</p>
                </div>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={() => navigate("/Home_Usuario")}
                >
                  ← Volver
                </button>
              </div>
              
              {/* Información del estacionamiento */}
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="mb-0">📍 Información del Estacionamiento</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <p className="mb-2">
                        <strong>📍 Dirección:</strong><br />
                        {estacionamientoActual?.direccion || estacionamiento.direccion}
                      </p>
                      <p className="mb-2">
                        <strong>💰 Precio:</strong> ${estacionamientoActual?.precio || estacionamiento.precio} MXN por hora
                      </p>
                    </div>
                    <div className="col-md-6">
                      <p className="mb-2">
                        <strong>⏰ Horario:</strong> {estacionamientoActual?.horario || estacionamiento.horario}
                      </p>
                      <p className="mb-2">
                        <strong>🅿️ Espacios Totales:</strong> {estacionamientoActual?.espacios_total || estacionamiento.espacios_total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información de disponibilidad */}
              <div className={`alert ${estacionamientoActual?.espacios_disponibles > 0 ? 'alert-success' : 'alert-warning'}`}>
                <div className="row">
                  <div className="col-md-8">
                    <strong>Estado actual de disponibilidad:</strong>
                    <div className="mt-2">
                      <div className="d-flex justify-content-between">
                        <span>Espacios totales:</span>
                        <span>{estacionamientoActual?.espacios_total || estacionamiento.espacios_total}</span>
                      </div>
                      <div className="d-flex justify-content-between fw-bold">
                        <span>Disponibles ahora:</span>
                        <span>{estacionamientoActual?.espacios_disponibles ?? estacionamiento.espacios_disponibles}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4 text-center">
                    <div className="display-6">
                      {(estacionamientoActual?.espacios_disponibles ?? estacionamiento.espacios_disponibles) > 0 ? "🅿️" : "🚫"}
                    </div>
                    <small className="text-muted">Estado actual</small>
                  </div>
                </div>
                
                {(estacionamientoActual?.espacios_disponibles ?? estacionamiento.espacios_disponibles) === 0 && (
                  <div className="mt-2 text-danger">
                    <strong>⚠️ No hay espacios disponibles actualmente.</strong><br />
                    <small>El propietario debe actualizar la disponibilidad.</small>
                  </div>
                )}
              </div>

              {/* Mensajes */}
              {mensaje && (
                <div className={`alert alert-${mensaje.tipo} alert-dismissible fade show`}>
                  {mensaje.texto}
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setMensaje(null)}
                  ></button>
                </div>
              )}

              {!selectedCajonId && (
                <div className="alert alert-warning">
                  ⚠️ Selecciona un espacio disponible en el detalle antes de continuar.
                </div>
              )}

              {selectedCajonId && (
                <div className="alert alert-info">
                  🅿️ Espacio seleccionado: <strong>#{selectedCajonId}</strong>
                </div>
              )}

              {/* Selector de espacios */}
              <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Selecciona un espacio</h5>
                  {(isLoadingZonas || isLoadingReservasFecha) && (
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                  )}
                </div>
                <div className="card-body">
                  {!fechaReserva ? (
                    <div className="alert alert-warning mb-0">
                      Selecciona fecha y horario para ver la disponibilidad.
                    </div>
                  ) : zonas && zonas.length > 0 ? (
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
                </div>
              </div>

              {/* Formulario de reserva */}
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">📝 Datos de la Reserva</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={confirmarReserva}>
                    <div className="mb-3">
                      <label htmlFor="placaVehiculo" className="form-label">
                        🚗 Placa del vehículo *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="placaVehiculo"
                        value={placaVehiculo}
                        onChange={(e) => setPlacaVehiculo(e.target.value.toUpperCase())}
                        placeholder="Ej: ABC123"
                        required
                        disabled={loading}
                        maxLength="10"
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="fechaReserva" className="form-label">
                        📅 Fecha de reserva *
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        id="fechaReserva"
                        value={fechaReserva}
                        onChange={(e) => setFechaReserva(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="horaInicio" className="form-label">
                            🕐 Hora inicio *
                          </label>
                          <input
                            type="time"
                            className="form-control"
                            id="horaInicio"
                            value={horaInicio}
                            onChange={(e) => setHoraInicio(e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="horaFin" className="form-label">
                            🕐 Hora fin *
                          </label>
                          <input
                            type="time"
                            className="form-control"
                            id="horaFin"
                            value={horaFin}
                            onChange={(e) => setHoraFin(e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resumen de precio */}
                    {horaInicio && horaFin && calcularDuracion() > 0 && (
                      <div className="alert alert-info">
                        <h6 className="mb-2">💰 Resumen de precio:</h6>
                        <div className="row">
                          <div className="col-6">
                            <strong>Duración:</strong> {calcularDuracion().toFixed(1)} horas
                          </div>
                          <div className="col-6">
                            <strong>Total:</strong> ${calcularPrecioTotal()} MXN
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="d-grid gap-2">
                      <button 
                        className="btn btn-primary btn-lg"
                        type="submit" 
                        id="btn-confirmar-reserva"
                        disabled={!puedeReservar || submitting}
                        aria-busy={submitting || loading}
                      >
                        {loading || submitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Procesando...
                          </>
                        ) : (
                          "💳 Reservar y Pagar"
                        )}
                      </button>
                      
                      {!puedeReservar && (estacionamientoActual?.espacios_disponibles ?? estacionamiento.espacios_disponibles) === 0 && (
                        <div className="text-center text-muted small">
                          ⚠️ No se puede reservar porque no hay espacios disponibles
                        </div>
                      )}
                      
                      <button 
                        type="button"
                        className="btn btn-outline-secondary" 
                        onClick={() => navigate("/Home_Usuario")}
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
         <PublicidadBanner />
      </div>

      {/* Modal de Pago PayPal */}
      {showPaymentModal && reservaCreada && (
        <PaymentModal
          reservaId={reservaCreada.id}
          monto={reservaCreada.monto}
          moneda="MXN"
          onSuccess={() => {
            setShowPaymentModal(false);
            setMensaje({
              tipo: "success",
              texto: `✅ ¡Reserva #${reservaCreada.id} pagada exitosamente! Redirigiendo...`
            });
            // Limpiar formulario
            setPlacaVehiculo("");
            setFechaReserva("");
            setHoraInicio("");
            setHoraFin("");
            setSelectedCajonId(null);
            cargarEstacionamientoActual();
            setTimeout(() => navigate("/mis-reservas"), 2500);
          }}
          onClose={() => {
            setShowPaymentModal(false);
            setMensaje({
              tipo: "warning",
              texto: `⚠️ Reserva #${reservaCreada.id} creada pero pendiente de pago. Ve a "Mis Reservas" para completar el pago.`
            });
          }}
        />
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
      `}</style>
    </div>
  );
}
