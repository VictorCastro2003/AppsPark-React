/* eslint-disable no-unused-vars */
// MisReservas.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import QRCode from "qrcode";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";

const API_URL = "http://localhost:8000/reservas"; // Ajusta tu URL base

export default function MisReservas() {
  const { user } = useAuth();
  const usuarioId = user?.id;
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [qrOpenId, setQrOpenId] = useState(null);
  const [qrModalReserva, setQrModalReserva] = useState(null);
  const [qrDataMap, setQrDataMap] = useState({});
  const [notificaciones, setNotificaciones] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    if (!usuarioId) return;
    fetchReservas();
    fetchNotificaciones();
  }, [usuarioId]);

  const fetchReservas = async () => {
    if (!usuarioId) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/usuario/${usuarioId}`);
      setReservas(res.data);
    } catch (err) {
      setError("Error al obtener reservas");
    } finally {
      setLoading(false);
    }
  };

  const cancelarReserva = async (reservaId) => {
    try {
      await axios.put(`${API_URL}/${reservaId}/cancelar`, null, {
        params: { usuario_id: usuarioId },
      });
      setReservas(reservas.filter((r) => r.id !== reservaId));
      alert("Reserva cancelada exitosamente");
    } catch (err) {
      alert("No se pudo cancelar la reserva");
    }
  };

  const getBadgeClass = (estado) => {
    switch (estado) {
      case "aceptada":
        return "bg-success";
      case "pendiente":
        return "bg-warning text-dark";
      case "rechazada":
      case "cancelada":
        return "bg-danger";
      default:
        return "bg-secondary";
    }
  };

  // 🔹 Función para formatear la fecha
  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "N/A";
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const fetchNotificaciones = async () => {
    if (!usuarioId) return;
    try {
      const res = await axios.get(`http://localhost:8000/notificaciones/usuario/${usuarioId}`);
      setNotificaciones(res.data || []);
    } catch (err) {
      setNotificaciones([]);
    }
  };

  const toggleQr = async (reserva) => {
    let token = reserva.salida_token;
    if (!token) {
      try {
        const res = await axios.post(`http://localhost:8000/reservas/${reserva.id}/token`);
        token = res.data?.salida_token;
        if (token) {
          setReservas((prev) =>
            prev.map((r) => (r.id === reserva.id ? { ...r, salida_token: token } : r))
          );
        }
      } catch (err) {
        return;
      }
    }
    if (!token) return;
    if (!qrDataMap[reserva.id]) {
      const dataUrl = await QRCode.toDataURL(token, { width: 220, margin: 1 });
      setQrDataMap((prev) => ({ ...prev, [reserva.id]: dataUrl }));
    }
    setQrOpenId(reserva.id);
    setQrModalReserva(reserva);
  };

  const formatHora = (hora) => {
    if (!hora) return "N/A";
    return typeof hora === "string" ? hora.slice(0, 5) : String(hora).slice(0, 5);
  };

  const calcTotal = (reserva) => {
    const precio = reserva.estacionamiento_precio ?? reserva.precio;
    if (!precio || !reserva.hora_inicio || !reserva.hora_fin) return null;
    const ini = new Date(`2000-01-01T${formatHora(reserva.hora_inicio)}`);
    const fin = new Date(`2000-01-01T${formatHora(reserva.hora_fin)}`);
    const diffHrs = (fin - ini) / (1000 * 60 * 60);
    if (!Number.isFinite(diffHrs) || diffHrs <= 0) return null;
    return (diffHrs * Number(precio)).toFixed(2);
  };

  const stats = reservas.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.estado === "pendiente") acc.pendientes += 1;
      if (r.estado === "aceptada") acc.aceptadas += 1;
      if (r.estado === "rechazada" || r.estado === "cancelada") acc.rechazadas += 1;
      return acc;
    },
    { total: 0, pendientes: 0, aceptadas: 0, rechazadas: 0 }
  );

  if (!usuarioId) return <div className="text-center mt-5">Inicia sesión para ver tus reservas.</div>;
  if (loading) return <div className="text-center mt-5">Cargando...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      <Sidebar currentPage="reservas" />
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f8f9fa" }}>
      <div className="container mt-2">
      {/* Encabezado con botón de volver */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">Mis Reservas</h3>
          <small className="text-muted">Historial y estado de tus reservas</small>
        </div>
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate(-1)}
        >
          <i className="bi bi-arrow-left me-2"></i> Volver
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card pending">
            <div className="stat-label">Pendientes</div>
            <div className="stat-value">{stats.pendientes}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card success">
            <div className="stat-label">Aceptadas</div>
            <div className="stat-value">{stats.aceptadas}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card danger">
            <div className="stat-label">Rechazadas</div>
            <div className="stat-value">{stats.rechazadas}</div>
          </div>
        </div>
      </div>

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

      {/* Lista de reservas */}
      {reservas.length === 0 ? (
        <div className="text-center text-muted mt-5">
          <i className="bi bi-calendar-x" style={{ fontSize: "3rem" }}></i>
          <p>No tienes reservas</p>
        </div>
      ) : (
        <div className="row">
          {reservas.map((reserva) => (
            <div key={reserva.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 reservation-card border-0">
                <div className="card-header reservation-header">
                  <div>
                    <div className="fw-semibold text-dark">
                      {reserva.estacionamiento_nombre || "Estacionamiento"}
                    </div>
                    <small className="text-muted">
                      {reserva.estacionamiento_direccion || "Dirección no disponible"}
                    </small>
                  </div>
                  <span className={`badge ${getBadgeClass(reserva.estado)}`}>
                    {reserva.estado}
                  </span>
                </div>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="text-muted small">
                      <i className="bi bi-calendar-event me-2"></i>
                      {formatFecha(reserva.fecha_reserva)}
                    </div>
                    <div className="price-pill">
                      ${calcTotal(reserva) ?? "N/A"}
                    </div>
                  </div>

                  <div className="time-row mb-3">
                    <div>
                      <div className="label">Inicio</div>
                      <div className="value">{formatHora(reserva.hora_inicio)}</div>
                    </div>
                    <div className="time-divider"></div>
                    <div>
                      <div className="label">Fin</div>
                      <div className="value">{formatHora(reserva.hora_fin)}</div>
                    </div>
                  </div>
                  <div className="text-muted small mb-3">
                    Cajón: {reserva.cajon_numero ?? reserva.cajon_id ?? "N/A"}
                  </div>

                  {!reserva.salida_usada && (
                    <div className="mb-3">
                      <button
                        className="btn btn-sm btn-outline-primary w-100"
                        onClick={() => toggleQr(reserva)}
                      >
                        Mostrar QR de salida
                      </button>

                      {reserva.estado !== "aceptada" && (
                        <div className="text-muted small mt-2">
                          El QR se activará cuando la reserva esté aceptada.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto d-flex gap-2">
                    {reserva.estado === "pendiente" && (
                      <button
                        className="btn btn-sm btn-outline-danger flex-fill"
                        onClick={() => cancelarReserva(reserva.id)}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-primary flex-fill"
                      onClick={() => setDetalle(reserva)}
                    >
                      Ver Detalles
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalles */}
      {detalle && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          role="dialog"
          onClick={() => setDetalle(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow">
              <div
                className="modal-header text-white"
                style={{ backgroundColor: "#3a7bd5" }}
              >
                <h5 className="modal-title fw-bold">
                  {detalle.estacionamiento_nombre || "Estacionamiento"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDetalle(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <i className="bi bi-calendar-event me-2"></i>
                  <strong>Fecha:</strong> {formatFecha(detalle.fecha_reserva)}
                </p>
                <p>
                  <i className="bi bi-clock me-2"></i>
                  <strong>Hora:</strong> {detalle.hora_inicio} - {detalle.hora_fin}
                </p>
                <p>
                  <i className="bi bi-check-circle me-2"></i>
                  <strong>Estado:</strong> {detalle.estado}
                </p>
                <p>
                  <i className="bi bi-cash me-2"></i>
                  <strong>Precio:</strong> ${calcTotal(detalle) ?? "N/A"}
                </p>
                <p>
                  <i className="bi bi-car-front me-2"></i>
                  <strong>Placa:</strong> {detalle.placa_vehiculo}
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setDetalle(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {qrModalReserva && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          role="dialog"
          onClick={() => setQrModalReserva(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow">
              <div className="modal-header text-white" style={{ backgroundColor: "#1f2937" }}>
                <h5 className="modal-title fw-bold">
                  QR de salida
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setQrModalReserva(null)}
                ></button>
              </div>
              <div className="modal-body d-flex flex-column align-items-center">
                {qrDataMap[qrModalReserva.id] ? (
                  <>
                    <img src={qrDataMap[qrModalReserva.id]} alt="QR salida" className="qr-img" />
                    <a
                      className="btn btn-dark w-100 mt-3"
                      href={qrDataMap[qrModalReserva.id]}
                      download={`reserva-${qrModalReserva.id}-salida.png`}
                    >
                      Descargar QR
                    </a>
                  </>
                ) : (
                  <div className="text-muted small">Generando QR...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .reservation-card {
          border-radius: 14px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.08);
        }
        .reservation-header {
          background: linear-gradient(135deg, #eef2ff, #ffffff);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e9ecef;
          padding: 1rem 1.25rem;
          border-top-left-radius: 14px;
          border-top-right-radius: 14px;
        }
        .price-pill {
          background: #111827;
          color: #fff;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .time-row {
          display: grid;
          grid-template-columns: 1fr 20px 1fr;
          align-items: center;
          gap: 8px;
          background: #f8f9ff;
          border: 1px solid #e6e8ff;
          border-radius: 12px;
          padding: 10px 12px;
        }
        .time-row .label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .time-row .value {
          font-weight: 700;
          color: #111827;
        }
        .time-divider {
          height: 22px;
          width: 1px;
          background: #d1d5db;
          margin: 0 auto;
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
        .stat-card.pending { border-color: #fde68a; background: #fff7ed; }
        .stat-card.success { border-color: #bbf7d0; background: #ecfdf3; }
        .stat-card.danger { border-color: #fecaca; background: #fef2f2; }
        .notif-item {
          background: #f8f9ff;
          border: 1px solid #e6e8ff;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .qr-img {
          width: 220px;
          height: 220px;
          object-fit: contain;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e5e7ff;
        }
      `}</style>
      </div>
      </div>
    </div>
  );
}
