import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function ReservasDuenio({ onReservaProcessed }) {
  const { user, token, getAuthHeaders } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [cargarReservasPendientes]);

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 fw-bold">Reservas Pendientes</h1>
        <button
          onClick={cargarReservasPendientes}
          className="btn btn-primary"
        >
          Actualizar
        </button>
      </div>

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
              <div className="card shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title">Reserva #{r.id}</h5>
                    <span className="badge bg-warning text-dark">Pendiente</span>
                  </div>

                  <ul className="list-unstyled mb-3">
                    <InfoRow icon="bi-person" label="Usuario ID" value={r.usuario_id} />
                    <InfoRow icon="bi-car-front" label="Cajón ID" value={r.cajon_id} />
                    <InfoRow icon="bi-calendar-date" label="Fecha" value={r.fecha_reserva} />
                    <InfoRow icon="bi-clock" label="Hora inicio" value={r.hora_inicio} />
                    <InfoRow icon="bi-hourglass-split" label="Hora fin" value={r.hora_fin} />
                  </ul>

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
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <li className="mb-1">
      <i className={`${icon} me-2 text-secondary`}></i>
      <strong>{label}:</strong> {value}
    </li>
  );
}
