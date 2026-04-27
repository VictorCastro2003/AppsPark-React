import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";

const API_BASE = "http://localhost:8000";

export default function Notificaciones() {
  const { user, getAuthHeaders } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificaciones = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/notificaciones/usuario/${user.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const marcarLeida = async (id) => {
    try {
      await fetch(`${API_BASE}/notificaciones/${id}/leida`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotificaciones();
  }, [user?.id]);

  return (
    <div className="d-flex min-vh-100">
      <Sidebar currentPage="notificaciones" />
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f5f7fb" }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="fw-bold mb-1">Notificaciones</h3>
            <small className="text-muted">Avisos recientes de tus reservas</small>
          </div>
          <button className="btn btn-primary" onClick={fetchNotificaciones}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-secondary" role="status"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-bell-slash display-3"></i>
            <p className="mt-3 fs-5">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {items.map((n) => (
              <div key={n.id} className={`notif-card ${n.leida ? "read" : ""}`}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">{n.titulo}</div>
                    <small className="text-muted">{n.mensaje}</small>
                  </div>
                  {!n.leida && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => marcarLeida(n.id)}
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <style>{`
          .notif-card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 12px 14px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.06);
          }
          .notif-card.read {
            opacity: 0.7;
          }
        `}</style>
      </div>
    </div>
  );
}
