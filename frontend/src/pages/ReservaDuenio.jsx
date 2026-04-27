import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function ReservasDuenio({ onReservaProcessed }) {
  const { user, token, getAuthHeaders } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [notificaciones, setNotificaciones] = useState([]);
  const scannerRef = useRef(null);

  const API_BASE = "http://localhost:8000"; 

  // Cargar reservas pendientes
  const cargarReservasPendientes = useCallback(async () => {
    if (!user?.id || !token) return;
    try {
      setIsLoading(true);

      const res = await fetch(`${API_BASE}/reservas/pendientes/${user.id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setReservas(data);
    } catch (err) {
      alert(`Error al cargar reservas: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, token, getAuthHeaders]);

  const fetchNotificaciones = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/notificaciones/usuario/${user.id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data || []);
      }
    } catch (err) {
      setNotificaciones([]);
    }
  }, [user, getAuthHeaders]);

  // Procesar reserva (aceptar o rechazar)
  const procesarReserva = async (reservaId, aceptar) => {
    try {
      const endpoint = `${API_BASE}/reservas/${reservaId}/${aceptar ? "aceptar" : "rechazar"}`;

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Error al procesar reserva");
      }

      const result = await res.json();
      alert(result.message || `Reserva ${aceptar ? "aceptada" : "rechazada"} exitosamente`);

      // recargar lista
      await cargarReservasPendientes();

      // notificar a padre
      if (onReservaProcessed) {
        onReservaProcessed();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    cargarReservasPendientes();
    fetchNotificaciones();
  }, [cargarReservasPendientes, fetchNotificaciones]);

  useEffect(() => {
    if (!showScanner) return;
    let html5Qrcode = null;
    let isActive = true;

    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!isActive) return;
      html5Qrcode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qrcode;
      html5Qrcode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            setScanMessage("Procesando QR...");
            try {
              const res = await fetch(`${API_BASE}/reservas/salida`, {
                method: "POST",
                headers: getAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ token: decodedText }),
              });
              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.detail || "Error al registrar salida");
              }
              setScanMessage(`Salida registrada. Exceso: ${data.minutos_exceso} min. Extra: $${data.costo_extra}`);
              await cargarReservasPendientes();
              await fetchNotificaciones();
              await html5Qrcode.stop();
              setShowScanner(false);
            } catch (err) {
              setScanMessage(err.message);
            }
          },
          () => {}
        )
        .catch((err) => {
          setScanMessage(`No se pudo iniciar la cámara: ${err}`);
        });
    };

    startScanner();

    return () => {
      isActive = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [showScanner, API_BASE, getAuthHeaders, cargarReservasPendientes, fetchNotificaciones]);

  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "N/A";
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatHora = (hora) => {
    if (!hora) return "N/A";
    return typeof hora === "string" ? hora.slice(0, 5) : String(hora).slice(0, 5);
  };

  const calcTotal = (reserva) => {
    const precio = reserva.estacionamiento_precio;
    if (!precio || !reserva.hora_inicio || !reserva.hora_fin) return null;
    const ini = new Date(`2000-01-01T${formatHora(reserva.hora_inicio)}`);
    const fin = new Date(`2000-01-01T${formatHora(reserva.hora_fin)}`);
    const diffHrs = (fin - ini) / (1000 * 60 * 60);
    if (!Number.isFinite(diffHrs) || diffHrs <= 0) return null;
    return (diffHrs * Number(precio)).toFixed(2);
  };

  const stats = reservas.reduce(
    (acc) => {
      acc.total += 1;
      return acc;
    },
    { total: 0 }
  );

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Reservas Pendientes</h1>
          <small className="text-muted">Gestiona solicitudes en tiempo real</small>
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={() => setShowScanner((v) => !v)}
            className="btn btn-outline-primary"
          >
            {showScanner ? "Cerrar lector" : "Escanear salida"}
          </button>
          <button
            onClick={cargarReservasPendientes}
            className="btn btn-primary"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-label">Pendientes</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
      </div>

      {showScanner && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3">Escáner de salida (QR)</h6>
            <div id="qr-reader" className="qr-reader"></div>
            {scanMessage && <div className="alert alert-info mt-3 mb-0">{scanMessage}</div>}
          </div>
        </div>
      )}

      {notificaciones.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="fw-bold mb-3">Notificaciones</h6>
            <div className="d-flex flex-column gap-2">
              {notificaciones.slice(0, 3).map((n) => (
                <div key={n.id} className="notif-item">
                  <div className="fw-semibold">{n.titulo}</div>
                  <small className="text-muted">{n.mensaje}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-secondary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : reservas.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x display-3"></i>
          <p className="mt-3 fs-5">No hay reservas pendientes</p>
        </div>
      ) : (
        <div className="row g-3">
          {reservas.map((r) => (
            <div key={r.id} className="col-12 col-md-6">
              <div className="card owner-reservation-card border-0">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="fw-semibold">Reserva #{r.id}</div>
                      <small className="text-muted">
                        {r.estacionamiento_nombre || "Estacionamiento"}
                      </small>
                    </div>
                    <div className="text-end">
                      <span className="badge bg-warning text-dark">Pendiente</span>
                      <div className="price-pill mt-2">
                        ${calcTotal(r) ?? "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="owner-meta mb-3">
                    <div>
                      <div className="label">Fecha</div>
                      <div className="value">{formatFecha(r.fecha_reserva)}</div>
                    </div>
                    <div>
                      <div className="label">Horario</div>
                      <div className="value">{formatHora(r.hora_inicio)} - {formatHora(r.hora_fin)}</div>
                    </div>
                    <div>
                      <div className="label">Cajón</div>
                      <div className="value">{r.cajon_numero ?? r.cajon_id ?? "N/A"}</div>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      onClick={() => procesarReserva(r.id, true)}
                      className="btn btn-success flex-fill d-flex align-items-center justify-content-center gap-2"
                    >
                      <i className="bi bi-check-circle"></i> Aceptar
                    </button>
                    <button
                      onClick={() => procesarReserva(r.id, false)}
                      className="btn btn-outline-danger flex-fill d-flex align-items-center justify-content-center gap-2"
                    >
                      <i className="bi bi-x-circle"></i> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .owner-reservation-card {
          border-radius: 14px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.08);
        }
        .owner-meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          background: #f8f9ff;
          border: 1px solid #e6e8ff;
          border-radius: 12px;
          padding: 10px 12px;
        }
        .owner-meta .label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .owner-meta .value {
          font-weight: 700;
          color: #111827;
        }
        .price-pill {
          background: #111827;
          color: #fff;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.05);
        }
        .stat-card .stat-label {
          font-size: 0.8rem;
          color: #6b7280;
        }
        .stat-card .stat-value {
          font-size: 1.4rem;
          font-weight: 700;
          color: #111827;
        }
        .notif-item {
          background: #f8f9ff;
          border: 1px solid #e6e8ff;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .qr-reader {
          border: 1px dashed #c7d2fe;
          border-radius: 12px;
          padding: 12px;
          background: #f5f6ff;
        }
        @media (max-width: 768px) {
          .owner-meta { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

