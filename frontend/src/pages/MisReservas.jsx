/* eslint-disable no-unused-vars */
// MisReservas.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:8000/reservas"; // Ajusta tu URL base
const usuarioId = 1; // 🔹 Cambia al usuario logueado

export default function MisReservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchReservas();
  }, []);

  const fetchReservas = async () => {
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

  if (loading) return <div className="text-center mt-5">Cargando...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      {/* Encabezado con botón de volver */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold" style={{ color: "#3a7bd5" }}>
          Mis Reservas
        </h3>
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate(-1)} // 🔹 Regresa a la página anterior
        >
          <i className="bi bi-arrow-left me-2"></i> Volver
        </button>
      </div>

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
              <div className="card h-100 shadow-sm border-0">
                <div
                  className="card-header text-white fw-bold"
                  style={{ backgroundColor: "#3a7bd5" }}
                >
                  {reserva.estacionamiento_nombre || "Estacionamiento"}
                </div>
                <div className="card-body d-flex flex-column">
                  <span
                    className={`badge ${getBadgeClass(reserva.estado)} mb-2`}
                    style={{ width: "fit-content" }}
                  >
                    {reserva.estado}
                  </span>

                  <p className="mb-1">
                    <i className="bi bi-calendar-event me-2"></i>
                    {formatFecha(reserva.fecha_reserva)}
                  </p>
                  <p className="mb-1">
                    <i className="bi bi-clock me-2"></i>
                    {reserva.hora_inicio} - {reserva.hora_fin}
                  </p>

                  <div className="mt-auto d-flex justify-content-between">
                    {reserva.estado === "pendiente" && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => cancelarReserva(reserva.id)}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-primary"
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
                  <strong>Precio:</strong> {detalle.precio || "N/A"}
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
    </div>
  );
}
