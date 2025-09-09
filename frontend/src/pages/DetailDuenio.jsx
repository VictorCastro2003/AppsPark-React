/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api'; // Importar el API service

const ParkingOwnerDetail = ({ onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const parkingData = location.state?.parkingData || {};
  
  const [futureData, setFutureData] = useState({ loading: true, data: null, error: null });
  const [imageWithDetections, setImageWithDetections] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (!parkingData.id) {
      setFutureData({
        loading: false,
        data: null,
        error: 'No se recibieron datos del estacionamiento'
      });
      return;
    }
    loadData();
  }, [parkingData]);

  const loadData = async () => {
    try {
      setFutureData({ loading: true, data: null, error: null });
      
      const results = await Promise.all([
        fetchImageAndDetections(),
        loadActiveReservations(),
      ]);

      const detections = results[0];
      const activeReservations = results[1];

      const statistics = calculateStatistics(detections, activeReservations);

      setFutureData({
        loading: false,
        data: {
          detections,
          activeReservations,
          statistics,
          success: true,
        },
        error: null
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setFutureData({
        loading: false,
        data: null,
        error: `Error al cargar datos: ${error.message}`
      });
    }
  };

  const fetchImageAndDetections = async () => {
    setIsLoadingImage(true);
    setImageError(null);
    setImageWithDetections(null);

    let detections = [];
    try {
      console.log('🔍 Detectando espacios para estacionamiento ID:', parkingData.id);
      
      // Usar el endpoint correcto que ya tienes funcionando en HomeDuenio
      const response = await fetch('http://localhost:8000/detect/estacionamiento/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parkingData.id), // Enviar solo el ID como en HomeDuenio
      });

      if (response.ok) {
        const data = await response.json();
        
        console.log('📊 Respuesta de detección:', data);
        
        if (data.image_annotated) {
          // La imagen ya viene como data URI completo
          setImageWithDetections(data.image_annotated);
          console.log('✅ Imagen anotada cargada correctamente');
        } else {
          setImageError('No se recibió imagen anotada del servidor.');
        }

        // Usar las detecciones del endpoint
        if (data.zones && Array.isArray(data.zones)) {
          detections = data.zones;
          console.log('📋 Detecciones procesadas:', detections.length, 'zonas');
        }

        // También podemos usar las estadísticas directas
        if (data.statistics) {
          console.log('📈 Estadísticas recibidas:', data.statistics);
        }

      } else {
        const errorText = await response.text();
        setImageError(`Error del servidor: ${response.status} - ${errorText}`);
        console.error('❌ Error en detección:', response.status, errorText);
      }
    } catch (error) {
      const errorMsg = `Error de conexión: ${error.message}`;
      setImageError(errorMsg);
      console.error('❌ Error de conexión:', error);
    } finally {
      setIsLoadingImage(false);
    }
    return detections;
  };

 const loadActiveReservations = async () => {
  try {
    const parkingId = parkingData.id;
    
    if (!parkingId) {
      console.log('⚠️ No hay ID de estacionamiento');
      return 0;
    }
    
    console.log('=== DEBUG RESERVAS ACTIVAS REALES (DUEÑO) ===');
    console.log('ID del estacionamiento:', parkingId);
    
    // Usar el endpoint corregido
    const response = await api.get(`/reservas/activas/${parkingId}`);
    
    console.log('Status code:', response.status);
    console.log('Response data:', response.data);

    if (response.status === 200) {
      const data = response.data;
      const reservasActivas = data.reservas_activas || 0;
      
      console.log('✅ Reservas activas REALES encontradas:', reservasActivas);
      console.log('=== FIN DEBUG RESERVAS ACTIVAS REALES ===\n');
      
      return reservasActivas;
    } else {
      console.log('⚠️ Respuesta no exitosa:', response.status);
      return 0;
    }
  } catch (error) {
    console.error('❌ Error al cargar reservas activas:', error);
    
    // Si es un error 404, es normal (no hay reservas)
    if (error.response && error.response.status === 404) {
      console.log('ℹ️ No se encontraron reservas activas (404 es normal)');
      return 0;
    }
    
    return 0;
  }
};

// CORRECCIÓN en calculateStatistics
const calculateStatistics = (detections, activeReservations) => {
  const totalSpaces = parkingData.espacios_total || 0;
  let availableSpacesBackend = parkingData.espacios_disponibles || 0;

  // Si tenemos datos YOLO, usar esos
  if (parkingData.hay_deteccion_yolo && parkingData.espacios_reales !== undefined) {
    availableSpacesBackend = parkingData.espacios_reales;
  }

  // CORREGIDO: Los espacios ocupados físicamente son independientes de las reservas
  const spacesDetectedByYOLO = availableSpacesBackend;
  const physicallyOccupied = totalSpaces - spacesDetectedByYOLO;
  
  // CAMBIO CLAVE: NO sumar reservas aquí
  // Las reservas son una categoría separada, no se suman a ocupación física
  
  return {
    total: totalSpaces,
    libres: Math.max(0, spacesDetectedByYOLO - activeReservations), // Disponibles para nuevas reservas
    reservados: activeReservations, // Reservas confirmadas (pero el espacio puede estar físicamente libre)
    ocupados_physical: Math.max(0, physicallyOccupied), // Solo ocupación física detectada por YOLO
  };
};

  const handleRefresh = () => {
    console.log('🔄 Refrescando datos...');
    loadData();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const StatItem = ({ icon, label, value, color }) => (
    <div className="text-center flex-fill">
      <i className={`fas fa-${icon} mb-2`} style={{ color, fontSize: '1.5rem' }}></i>
      <div className="fw-bold" style={{ color, fontSize: '1.25rem' }}>
        {value}
      </div>
      <small className="text-muted">{label}</small>
    </div>
  );

  const AdvancedStat = ({ title, value, icon, color }) => (
    <div 
      className="p-3 rounded border"
      style={{ 
        backgroundColor: `${color}20`, 
        borderColor: `${color}50` 
      }}
    >
      <div className="d-flex align-items-center mb-2">
        <i className={`fas fa-${icon} me-2`} style={{ color }}></i>
        <small className="text-muted fw-medium">{title}</small>
      </div>
      <div className="fw-bold" style={{ color, fontSize: '1.125rem' }}>
        {value}
      </div>
    </div>
  );

  const ImageSection = ({ statistics }) => {
    const freeSpaces = statistics?.libres || 0;
    
    return (
      <div 
        className="position-relative rounded shadow-sm overflow-hidden"
        style={{ height: '250px', backgroundColor: '#e9ecef' }}
      >
        {isLoadingImage ? (
          <div className="d-flex justify-content-center align-items-center h-100">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <div className="ms-3">
              <div className="text-muted">Detectando espacios...</div>
              <small className="text-muted">Esto puede tomar unos segundos</small>
            </div>
          </div>
        ) : imageError ? (
          <div className="d-flex flex-column justify-content-center align-items-center h-100 p-3">
            <i className="fas fa-exclamation-triangle text-danger mb-2" style={{ fontSize: '2.5rem' }}></i>
            <div className="text-center text-danger mb-3">
              <strong>Error al cargar detección:</strong>
              <br />
              <small>{imageError}</small>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleRefresh}>
              <i className="fas fa-refresh me-1"></i>
              Reintentar Detección
            </button>
          </div>
        ) : imageWithDetections ? (
          <div 
            className="h-100 w-100 position-relative"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowFullImage(true)}
          >
            <img
              src={imageWithDetections}
              alt="Estacionamiento con detecciones"
              className="w-100 h-100"
              style={{ objectFit: 'contain' }}
            />
            <div className="position-absolute bottom-0 end-0 m-2">
              <small className="badge bg-success">
                <i className="fas fa-search-plus me-1"></i>
                Click para ampliar
              </small>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column justify-content-center align-items-center h-100">
            <i className="fas fa-image text-muted mb-2" style={{ fontSize: '3rem' }}></i>
            <div className="text-muted mb-3">Imagen de detección no disponible</div>
            <button className="btn btn-primary btn-sm" onClick={handleRefresh}>
              <i className="fas fa-camera me-1"></i>
              Generar Detección
            </button>
          </div>
        )}
        
        {/* Badge de espacios libres */}
        <div 
          className={`position-absolute bottom-0 start-0 m-2 px-3 py-1 rounded text-white fw-bold`}
          style={{ 
            backgroundColor: freeSpaces > 0 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)' 
          }}
        >
          {freeSpaces > 0 ? `✅ Libres: ${freeSpaces}` : '⚠️ Completo'}
        </div>
        
        {/* Badge YOLO si hay imagen */}
        {imageWithDetections && (
          <div 
            className="position-absolute top-0 end-0 m-3 px-2 py-1 rounded d-flex align-items-center"
            style={{ backgroundColor: 'rgba(40, 167, 69, 0.9)' }}
          >
            <div 
              className="rounded-circle me-1"
              style={{ width: '6px', height: '6px', backgroundColor: 'white' }}
            ></div>
            <small className="text-white fw-bold" style={{ fontSize: '0.625rem' }}>
              DETECCIÓN ACTIVA
            </small>
          </div>
        )}
      </div>
    );
  };

  // Loading state
  if (futureData.loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div className="text-muted">
            Cargando información del estacionamiento...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (futureData.error) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-exclamation-triangle text-muted mb-3" style={{ fontSize: '4rem' }}></i>
        <div className="text-muted mb-3">
          {futureData.error}
        </div>
        <div className="d-flex justify-content-center gap-2">
          <button className="btn btn-primary" onClick={handleRefresh}>
            <i className="fas fa-refresh me-1"></i>
            Reintentar
          </button>
          <button className="btn btn-secondary" onClick={handleBack}>
            <i className="fas fa-arrow-left me-1"></i>
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (!futureData.data?.success) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-exclamation-triangle text-warning mb-3" style={{ fontSize: '4rem' }}></i>
        <div className="text-muted mb-3">
          No se pudieron cargar los datos correctamente
        </div>
        <div className="d-flex justify-content-center gap-2">
          <button className="btn btn-primary" onClick={handleRefresh}>
            <i className="fas fa-refresh me-1"></i>
            Reintentar
          </button>
          <button className="btn btn-secondary" onClick={handleBack}>
            <i className="fas fa-arrow-left me-1"></i>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { detections, activeReservations, statistics } = futureData.data;
  const freeSpaces = statistics.libres || 0;
  const totalSpaces = statistics.total || 0;
  const reservedSpaces = statistics.reservados || 0;
  const occupiedPhysicalNonReserved = statistics.ocupados_physical || 0;
  const occupiedYOLODetected = statistics.ocupados_yolo || 0;
  
  const totalOccupiedForPercentage = occupiedPhysicalNonReserved + reservedSpaces;
  const occupancyPercentage = totalSpaces > 0 ? (totalOccupiedForPercentage / totalSpaces) * 100 : 0;
  const hourlyPrice = parkingData.precio || 15.50;
  const estimatedIncome = totalOccupiedForPercentage * hourlyPrice;

  return (
    <div className="container-fluid p-4" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <button className="btn btn-outline-secondary me-3" onClick={handleBack}>
            <i className="fas fa-arrow-left me-1"></i>
            Volver
          </button>
          <div>
            <h2 className="mb-0">{parkingData.nombre || 'Estacionamiento'}</h2>
            {parkingData.hay_deteccion_yolo && (
              <small className="badge bg-success mt-1">
                <i className="fas fa-eye me-1"></i>
                Detección YOLO Activa
              </small>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh}>
          <i className="fas fa-sync-alt me-1"></i>
          Actualizar
        </button>
      </div>

      <div className="row g-4">
        {/* Imagen de detección */}
        <div className="col-12">
          <ImageSection statistics={statistics} />
        </div>

        {/* Información básica */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center">
                <i className="fas fa-info-circle text-primary me-2"></i>
                Información General
              </h5>
              <div className="mb-2">
                <i className="fas fa-map-marker-alt text-danger me-2"></i>
                <span className="text-muted">{parkingData.direccion || 'Dirección no disponible'}</span>
              </div>
              <div className="mb-2">
                <i className="fas fa-dollar-sign text-success me-2"></i>
                <span className="text-success fw-medium">
                  ${(hourlyPrice).toFixed(2)} MXN por hora
                </span>
              </div>
              <div className="mb-2">
                <i className="fas fa-clock text-primary me-2"></i>
                <span className="text-muted">{parkingData.horario || 'Horario no disponible'}</span>
              </div>
              {parkingData.hay_deteccion_yolo && (
                <div className="mt-3 p-2 bg-success-subtle rounded">
                  <small className="text-success">
                    <i className="fas fa-robot me-1"></i>
                    Sistema de detección automática habilitado
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disponibilidad */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center">
                <i className="fas fa-chart-pie text-info me-2"></i>
                Estado Actual
              </h5>
              <div 
                className={`p-3 rounded border d-flex align-items-center mb-3`}
                style={{ 
                  backgroundColor: freeSpaces > 0 ? '#d4edda' : '#f8d7da',
                  borderColor: freeSpaces > 0 ? '#c3e6cb' : '#f5c6cb'
                }}
              >
                <i 
                  className={`fas ${freeSpaces > 0 ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-3`}
                  style={{ fontSize: '2rem' }}
                ></i>
                <div>
                  <div className={`fw-bold ${freeSpaces > 0 ? 'text-success' : 'text-danger'}`}>
                    {freeSpaces > 0 ? 'DISPONIBLE' : 'COMPLETO'}
                  </div>
                  <div className={`${freeSpaces > 0 ? 'text-success' : 'text-danger'}`}>
                    {freeSpaces > 0 
                      ? `${freeSpaces} de ${totalSpaces} espacios libres`
                      : 'Todos los espacios ocupados'
                    }
                  </div>
                </div>
              </div>
              <div className="d-flex justify-content-between">
                <StatItem icon="car" label="Total" value={totalSpaces} color="#007bff" />
                <StatItem icon="check-circle" label="Libres" value={freeSpaces} color="#28a745" />
                <StatItem icon="mobile-alt" label="Reservados" value={reservedSpaces} color="#fd7e14" />
                <StatItem icon="times-circle" label="Ocupados" value={occupiedPhysicalNonReserved} color="#dc3545" />
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas avanzadas */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center">
                <i className="fas fa-chart-line text-primary me-2"></i>
                Estadísticas Avanzadas
              </h5>
              <div className="row g-3">
                <div className="col-md-3">
                  <AdvancedStat
                    title="Ocupación"
                    value={`${occupancyPercentage.toFixed(1)}%`}
                    icon="chart-line"
                    color={occupancyPercentage > 80 ? '#dc3545' : occupancyPercentage > 50 ? '#fd7e14' : '#28a745'}
                  />
                </div>
                <div className="col-md-3">
                  <AdvancedStat
                    title="Reservas Activas"
                    value={reservedSpaces}
                    icon="calendar-check"
                    color="#007bff"
                  />
                </div>
                <div className="col-md-3">
                  <AdvancedStat
                    title="Ingresos Estimados/hora"
                    value={`$${estimatedIncome.toFixed(2)}`}
                    icon="coins"
                    color="#28a745"
                  />
                </div>
                <div className="col-md-3">
                  <AdvancedStat
                    title="Eficiencia de Detección"
                    value={parkingData.hay_deteccion_yolo ? "100%" : "Manual"}
                    icon="eye"
                    color={parkingData.hay_deteccion_yolo ? "#28a745" : "#6c757d"}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones de gestión */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title d-flex align-items-center">
                <i className="fas fa-tools text-secondary me-2"></i>
                Acciones de Gestión
              </h5>
              <div className="row g-2">
                <div className="col-md-3">
                  <button 
                    className="btn btn-primary w-100"
                    onClick={() => navigate('/reservas-duenio', { state: { estacionamientoId: parkingData.id } })}
                  >
                    <i className="fas fa-clipboard-list me-1"></i>
                    Gestionar Reservas
                  </button>
                </div>
                <div className="col-md-3">
                  <button className="btn btn-secondary w-100">
                    <i className="fas fa-cog me-1"></i>
                    Configurar
                  </button>
                </div>
                <div className="col-md-3">
                  <button className="btn btn-outline-primary w-100">
                    <i className="fas fa-history me-1"></i>
                    Ver Historial
                  </button>
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-primary w-100"
                    onClick={handleRefresh}
                  >
                    <i className="fas fa-sync-alt me-1"></i>
                    Actualizar Datos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de imagen completa */}
      {showFullImage && imageWithDetections && (
        <div 
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setShowFullImage(false)}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="position-relative">
              <img
                src={imageWithDetections}
                alt="Detección completa del estacionamiento"
                className="w-100"
                style={{ maxHeight: '90vh', objectFit: 'contain' }}
              />
              <button
                className="btn btn-dark position-absolute top-0 end-0 m-3"
                onClick={() => setShowFullImage(false)}
              >
                <i className="fas fa-times"></i>
              </button>
              <div className="position-absolute bottom-0 start-0 m-3 text-white">
                <h5>{parkingData.nombre}</h5>
                <p className="mb-0">Detección automática con YOLO</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingOwnerDetail;