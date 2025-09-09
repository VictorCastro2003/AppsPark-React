/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

// URL de tu backend FastAPI
const API_URL = "http://localhost:8000";

/* =====================================================
   🔹 Componente: Header principal
===================================================== */
function MainHeader({ user, onRefresh }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 className="mb-1">Buscar Estacionamiento</h2>
        <p className="text-muted mb-0">
          Hola, {user?.username || "Usuario"}! Encuentra el lugar perfecto para estacionar
        </p>
      </div>
      <div className="d-flex align-items-center gap-3">
        <button className="btn btn-outline-secondary" onClick={onRefresh}>
          🔄 Actualizar
        </button>
        <div
          className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: "40px", height: "40px" }}
        >
          {(user?.username || "U")[0].toUpperCase()}
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   🔹 Componente: Filtros de búsqueda
===================================================== */
function SearchFilters({ onFiltersChange, filters }) {
  const handleInputChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="mb-0">Filtros de Búsqueda</h5>
      </div>
      <div className="card-body">
        <div className="row g-3">
          {/* Búsqueda por texto */}
          <div className="col-md-5">
            <div className="input-group">
              <span className="input-group-text">🔍</span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o ubicación"
                value={filters.searchText}
                onChange={(e) => handleInputChange("searchText", e.target.value)}
              />
            </div>
          </div>

          {/* Precio máximo */}
          <div className="col-md-3">
            <div className="input-group">
              <span className="input-group-text">💰</span>
              <input
                type="number"
                className="form-control"
                placeholder="Precio máximo/hora"
                value={filters.maxPrice}
                onChange={(e) => handleInputChange("maxPrice", e.target.value)}
              />
            </div>
          </div>

          {/* Solo disponibles */}
          <div className="col-md-2">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={filters.onlyAvailable}
                onChange={(e) =>
                  handleInputChange("onlyAvailable", e.target.checked)
                }
                id="switchAvailable"
              />
              <label className="form-check-label" htmlFor="switchAvailable">
                Solo disponibles
              </label>
            </div>
          </div>

          {/* Botón limpiar */}
          <div className="col-md-2">
            <button
              className="btn btn-outline-secondary w-100"
              onClick={() =>
                onFiltersChange({
                  searchText: "",
                  maxPrice: "",
                  onlyAvailable: false,
                })
              }
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   🔹 Componente: Resumen de estadísticas
===================================================== */
function StatsCards({ stats }) {
  return (
    <div className="row mb-4">
      <div className="col-md-4">
        <div className="card text-center border-primary">
          <div className="card-body">
            <div className="display-6 text-primary mb-2">🔍</div>
            <h3 className="text-primary">{stats.found}</h3>
            <p className="text-muted mb-0">Encontrados</p>
          </div>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card text-center border-success">
          <div className="card-body">
            <div className="display-6 text-success mb-2">🅿️</div>
            <h3 className="text-success">{stats.available}</h3>
            <p className="text-muted mb-0">Disponibles</p>
          </div>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card text-center border-warning">
          <div className="card-body">
            <div className="display-6 text-warning mb-2">💰</div>
            <h3 className="text-warning">${stats.avgPrice}</h3>
            <p className="text-muted mb-0">Precio Promedio</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   🔹 Componente: Tarjeta de estacionamiento
===================================================== */
function ParkingCard({ estacionamiento, onReserve, onDetails }) {
  const disponible = estacionamiento.espacios_disponibles > 0;

  return (
    <div className="col-xl-6 mb-4">
      <div className="card h-100 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">{estacionamiento.nombre}</h5>
          <span className={`badge ${disponible ? "bg-success" : "bg-danger"}`}>
            {disponible ? "DISPONIBLE" : "LLENO"}
          </span>
        </div>

        <div className="card-body">
          {/* Información básica */}
          <div className="mb-3">
            <div className="d-flex align-items-center mb-2">
              <span className="me-2">📍</span>
              <small>
                <strong>Dirección:</strong> {estacionamiento.direccion}
              </small>
            </div>
            <div className="d-flex align-items-center mb-2">
              <span className="me-2">⏰</span>
              <small>
                <strong>Horario:</strong> {estacionamiento.horario}
              </small>
            </div>
            <div className="d-flex align-items-center">
              <span className="me-2">💰</span>
              <small>
                <strong>Precio:</strong> ${estacionamiento.precio} MXN/hora
              </small>
            </div>
          </div>

          {/* Estado de disponibilidad */}
          <div
            className={`alert ${
              disponible ? "alert-success" : "alert-danger"
            } d-flex justify-content-between align-items-center`}
          >
            <div>
              <div className="fw-bold">Espacios Disponibles</div>
              <div className="h4 mb-0">
                {estacionamiento.espacios_disponibles} de{" "}
                {estacionamiento.espacios_total}
              </div>
              <small className="text-muted fst-italic">
                Actualizado por el propietario
              </small>
            </div>
            <div className="display-6">{disponible ? "🅿️" : "🚫"}</div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="card-footer">
          <div className="row g-2">
            <div className="col-8">
              <button
                className={`btn w-100 ${
                  disponible ? "btn-success" : "btn-secondary"
                }`}
                onClick={() => onReserve(estacionamiento)}
                disabled={!disponible}
              >
                📅 Reservar
              </button>
            </div>
            <div className="col-4">
              <button
                onClick={() => onDetails(estacionamiento)}
                className="btn btn-outline-primary w-100"
                title="Ver detalles completos"
              >
                👁️ Detalles
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   🔹 Componente principal: Home Usuario
===================================================== */
export default function HomeUsuario() {
  const navigate = useNavigate();

  const [estacionamientos, setEstacionamientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user] = useState({ username: "Usuario" }); // Simular usuario logueado
  const [filters, setFilters] = useState({
    searchText: "",
    maxPrice: "",
    onlyAvailable: true,
  });

  // Cargar estacionamientos desde el backend
  const fetchEstacionamientos = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.searchText) params.append("nombre", filters.searchText);
      if (filters.maxPrice) params.append("precio_max", filters.maxPrice);
      if (filters.onlyAvailable) params.append("solo_disponibles", "true");

      const response = await fetch(
        `${API_URL}/estacionamientos?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setEstacionamientos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando estacionamientos:", err);
      setError(err.message);
      setEstacionamientos([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar estacionamientos localmente
  const filteredEstacionamientos = estacionamientos.filter((e) => {
    const matchesText =
      !filters.searchText ||
      e.nombre.toLowerCase().includes(filters.searchText.toLowerCase()) ||
      e.direccion.toLowerCase().includes(filters.searchText.toLowerCase());

    const matchesPrice =
      !filters.maxPrice || e.precio <= parseFloat(filters.maxPrice);

    const matchesAvailability =
      !filters.onlyAvailable || e.espacios_disponibles > 0;

    return matchesText && matchesPrice && matchesAvailability;
  });

  // Calcular estadísticas
  const stats = {
    found: filteredEstacionamientos.length,
    available: filteredEstacionamientos.filter(
      (e) => e.espacios_disponibles > 0
    ).length,
    avgPrice:
      filteredEstacionamientos.length > 0
        ? (
            filteredEstacionamientos.reduce((sum, e) => sum + e.precio, 0) /
            filteredEstacionamientos.length
          ).toFixed(2)
        : "0.00",
  };

  // Manejar reserva → Navegar a pantalla ReservaUsuario
  const handleReserve = (estacionamiento) => {
    navigate("/reservas_usuario", { state: { estacionamiento } });
  };

  // Manejar navegación a detalles
  const handleDetails = (estacionamiento) => {
    navigate("/detail_usuario", {
      state: {
        estacionamientoData: estacionamiento,
        fromSearch: true,
      },
    });
  };

  // Manejar logout
  const handleLogout = () => {
    alert("Sesión cerrada");
    // Aquí integrarías con tu sistema de autenticación
    // navigate('/login');
  };

  // Cargar datos al montar el componente y cuando cambien los filtros
  useEffect(() => {
    fetchEstacionamientos();
  }, [filters.onlyAvailable]);

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      {/* Sidebar */}
      <Sidebar user={user} onLogout={handleLogout} currentPage="buscar" />

      {/* Contenido principal */}
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f8f9fa" }}>
        {/* Header */}
        <MainHeader user={user} onRefresh={fetchEstacionamientos} />

        {/* Filtros */}
        <SearchFilters filters={filters} onFiltersChange={setFilters} />

        {/* Estadísticas */}
        <StatsCards stats={stats} />

        {/* Estado de carga */}
        {loading && (
          <div className="text-center p-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-2">Cargando estacionamientos...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-danger text-center">
            <h5>❌ Error al cargar estacionamientos</h5>
            <p>{error}</p>
            <button
              className="btn btn-outline-danger"
              onClick={fetchEstacionamientos}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Contenido principal */}
        {!loading && !error && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4>Estacionamientos Disponibles</h4>
              <small className="text-muted">
                Mostrando {filteredEstacionamientos.length} resultados
              </small>
            </div>

            {filteredEstacionamientos.length === 0 ? (
              <div className="text-center p-5">
                <div className="display-1 text-muted mb-3">🚫</div>
                <h3 className="text-muted">
                  No se encontraron estacionamientos
                </h3>
                <p className="text-muted">Intenta ajustar los filtros de búsqueda</p>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setFilters({
                      searchText: "",
                      maxPrice: "",
                      onlyAvailable: false,
                    })
                  }
                >
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="row">
                {filteredEstacionamientos.map((estacionamiento) => (
                  <ParkingCard
                    key={estacionamiento.id}
                    estacionamiento={estacionamiento}
                    onReserve={handleReserve}
                    onDetails={handleDetails}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
