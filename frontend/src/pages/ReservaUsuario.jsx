/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const API_URL = "http://localhost:8000";

export default function ReservaUsuario() {
  const navigate = useNavigate();
  const location = useLocation();

  // Datos del estacionamiento pasados desde el router
  const estacionamiento = location.state?.estacionamiento;

  // Estados del formulario
  const [placaVehiculo, setPlacaVehiculo] = useState("");
  const [fechaReserva, setFechaReserva] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [estacionamientoActual, setEstacionamientoActual] = useState(estacionamiento);
  const [user] = useState({ username: "Usuario" }); // Simular usuario logueado

  // Validación mejorada
  const puedeReservar = 
    placaVehiculo.trim() !== "" && 
    fechaReserva && 
    horaInicio && 
    horaFin &&
    !loading &&
    new Date(`${fechaReserva}T${horaInicio}`) < new Date(`${fechaReserva}T${horaFin}`) &&
    estacionamientoActual?.espacios_disponibles > 0;

  // Cargar datos actuales del estacionamiento
  useEffect(() => {
    if (estacionamiento?.id) {
      cargarEstacionamientoActual();
    }
  }, [estacionamiento]);

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

  const confirmarReserva = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    try {
      const reservaData = {
        estacionamiento_id: estacionamiento.id,
        usuario_id: 1, // Reemplazar con el ID del usuario logueado
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
          texto: `✅ ${data.message || 'Reserva creada exitosamente'}.`
        });
        
        // Limpiar formulario
        setPlacaVehiculo("");
        setFechaReserva("");
        setHoraInicio("");
        setHoraFin("");
        
        // Recargar datos del estacionamiento
        setTimeout(() => {
          cargarEstacionamientoActual();
        }, 1000);
        
        // Navegar después de 3 segundos
        setTimeout(() => navigate("/Home_Usuario"), 3000);
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
                        disabled={!puedeReservar}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Procesando...
                          </>
                        ) : (
                          "🎯 Confirmar Reserva"
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
      </div>
    </div>
  );
}