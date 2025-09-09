/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";

const HomeDuenio = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [estacionamientos, setEstacionamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDetectingSpaces, setIsDetectingSpaces] = useState(false);
  const [detectionError, setDetectionError] = useState(null);
  
  // Space tracking maps
  const [espaciosDisponiblesPorEstacionamiento, setEspaciosDisponiblesPorEstacionamiento] = useState({});
  const [reservasActivasPorEstacionamiento, setReservasActivasPorEstacionamiento] = useState({});
  const [espaciosRealesDisponibles, setEspaciosRealesDisponibles] = useState({});

  // Recalculate real spaces whenever YOLO or reservations data changes
  useEffect(() => {
    if (Object.keys(espaciosDisponiblesPorEstacionamiento).length > 0 || 
        Object.keys(reservasActivasPorEstacionamiento).length > 0) {
      calcularEspaciosReales();
    }
  }, [espaciosDisponiblesPorEstacionamiento, reservasActivasPorEstacionamiento]);

  // Check authentication and redirect if necessary
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Initialize data on component mount
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      initializeData();
    }
  }, [authLoading, isAuthenticated, user]);

  const debugUserInfo = () => {
    console.log('\n🔍 === DEBUG INFORMACIÓN DEL USUARIO ===');
    console.log('🔍 Usuario completo:', user);
    console.log('🆔 ID del usuario:', user?.id, '(Tipo:', typeof user?.id, ')');
    console.log('👤 Username:', user?.username);
    console.log('📧 Email:', user?.email);
    console.log('🏷️ Rol:', user?.rol);
    console.log('🔒 Autenticado:', isAuthenticated);
    console.log('⏳ Cargando auth:', authLoading);
    console.log('==========================================\n');
  };

  const initializeData = async () => {
    console.log('\n🚀 === INICIALIZANDO DATOS ===');
    
    // Debug user info
    debugUserInfo();
    
    if (!user?.id) {
      console.log('❌ No hay usuario ID disponible');
      setError('Usuario no autenticado correctamente. Por favor, inicia sesión nuevamente.');
      setLoading(false);
      return;
    }

    try {
      console.log('👤 Usuario ID que se enviará a la API:', user.id);
      
      // Fetch parking lots for owner
      const response = await api.get(`/estacionamientos/duenio/${user.id}`);
      const estacionamientosData = response.data;
      
      console.log('🏢 Estacionamientos encontrados:', estacionamientosData.length);
      
      if (estacionamientosData.length === 0) {
        console.log('⚠️ NO SE ENCONTRARON ESTACIONAMIENTOS');
        setEstacionamientos([]);
        setLoading(false);
        return;
      }
      
      setEstacionamientos(estacionamientosData);
      
      // PASO 1: Inicializar con valores por defecto para mostrar algo inmediatamente
      console.log('\n⚡ PASO 1: Inicializando valores por defecto...');
      const valoresDefecto = {};
      const reservasDefecto = {};
      estacionamientosData.forEach(est => {
        valoresDefecto[est.id] = 0; // Empezar en 0 hasta que YOLO responda
        reservasDefecto[est.id] = 0;
      });
      setEspaciosDisponiblesPorEstacionamiento(valoresDefecto);
      setReservasActivasPorEstacionamiento(reservasDefecto);
      setEspaciosRealesDisponibles(valoresDefecto);
      
      // PASO 2: Detectar espacios con YOLO (en background)
      console.log('\n🤖 PASO 2: Detectando espacios con YOLO...');
      detectarEspaciosParaTodos(estacionamientosData);
      
      // PASO 3: Cargar reservas activas (en background)
      console.log('\n📅 PASO 3: Cargando reservas activas...');
      cargarReservasActivas(estacionamientosData);
      
      console.log('\n✅ === INICIALIZACIÓN COMPLETADA (continuando en background) ===');
      
    } catch (error) {
      console.error('❌ Error al cargar estacionamientos:', error);
      setError(error.response?.data?.message || error.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const detectarEspaciosParaTodos = async (estacionamientosData) => {
    if (!estacionamientosData.length) return;

    setIsDetectingSpaces(true);
    setDetectionError(null);

    try {
      const nuevosEspaciosYolo = {};
      
      // Detect spaces for each parking lot
      for (const estacionamiento of estacionamientosData) {
        console.log(`🤖 Detectando espacios para: ${estacionamiento.nombre}`);
        const espacios = await detectarEspaciosIndividual(estacionamiento.id);
        nuevosEspaciosYolo[estacionamiento.id] = espacios;
        console.log(`✅ ${estacionamiento.nombre}: ${espacios} espacios detectados`);
      }
      
      console.log('🎯 Actualizando estado con YOLO:', nuevosEspaciosYolo);
      setEspaciosDisponiblesPorEstacionamiento(nuevosEspaciosYolo);
      
    } catch (e) {
      setDetectionError(e.toString());
      console.error('❌ Error en detección YOLO:', e);
    } finally {
      setIsDetectingSpaces(false);
    }
  };

  const detectarEspaciosIndividual = async (estacionamientoId) => {
  try {
    const response = await fetch('http://localhost:8000/detect/estacionamiento/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estacionamientoId), // Solo envía el ID
    });

    if (response.ok) {
      const data = await response.json();
      return data.available || 0;
    }else {
        throw new Error(`Error del servidor: ${response.status}`);
      }
    } catch (e) {
      throw new Error(`Error de conexión: ${e.message}`);
    }
  };

  const cargarReservasActivas = async (estacionamientosData) => {
    console.log('\n📅 === CARGANDO RESERVAS ACTIVAS ===');
    
    try {
      const nuevasReservasActivas = {};
      
      for (const estacionamiento of estacionamientosData) {
        console.log(`🔍 Consultando reservas para: ${estacionamiento.nombre} (ID: ${estacionamiento.id})`);
        
        const reservasActivas = await obtenerReservasActivasDelEstacionamiento(estacionamiento.id);
        nuevasReservasActivas[estacionamiento.id] = reservasActivas;
        
        console.log(`✅ ${estacionamiento.nombre}: ${reservasActivas} reservas activas CONFIRMADAS`);
      }
      
      console.log('🎯 Actualizando estado con reservas:', nuevasReservasActivas);
      setReservasActivasPorEstacionamiento(nuevasReservasActivas);
      
    } catch (e) {
      console.error('❌ Error al cargar reservas activas:', e);
      // If loading fails, assume 0 reservations
      const defaultReservas = {};
      estacionamientosData.forEach(est => {
        defaultReservas[est.id] = 0;
      });
      setReservasActivasPorEstacionamiento(defaultReservas);
    }
  };

 const obtenerReservasActivasDelEstacionamiento = async (estacionamientoId) => {
  try {
    const response = await api.get(`/reservas/activas/${estacionamientoId}`);
    
    console.log(`🔍 Consultando reservas activas REALES para estacionamiento ${estacionamientoId}`);
    console.log('📡 Status Code:', response.status);
    console.log('📄 Response Data:', response.data);

    if (response.status === 200) {
      const data = response.data;
      
      // Usar directamente reservas_activas (que ahora son las reales)
      let reservasActivas = data.reservas_activas || 0;
      
      console.log('✅ Reservas activas REALES encontradas:', reservasActivas);
      return reservasActivas;
      
    } else if (response.status === 404) {
      console.log('ℹ️ No hay reservas activas para este estacionamiento');
      return 0;
    } else {
      console.log('❌ Error del servidor:', response.status);
      return 0;
    }
  } catch (e) {
    console.error('❌ Error al obtener reservas activas:', e);
    return 0;
  }
};

  const calcularEspaciosReales = () => {
    console.log('\n🧮 === CALCULANDO ESPACIOS REALES ===');
    const nuevosEspaciosReales = {};
    
    Object.entries(espaciosDisponiblesPorEstacionamiento).forEach(([estacionamientoId, espaciosYolo]) => {
      const reservasActivas = reservasActivasPorEstacionamiento[estacionamientoId] || 0;
      
      // Formula: Real Spaces = YOLO Spaces - Active Reservations
      const espaciosReales = Math.max(0, Math.min(espaciosYolo - reservasActivas, espaciosYolo));
      nuevosEspaciosReales[parseInt(estacionamientoId)] = espaciosReales;
      
      console.log(`🏢 Estacionamiento ${estacionamientoId}:`);
      console.log(`   🤖 YOLO detectó: ${espaciosYolo} espacios libres`);
      console.log(`   📅 Reservas activas: ${reservasActivas}`);
      console.log(`   ✨ Disponibles reales: ${espaciosReales}`);
      console.log(`   📢 Fórmula: ${espaciosYolo} - ${reservasActivas} = ${espaciosReales}`);
      console.log('');
    });
    
    setEspaciosRealesDisponibles(nuevosEspaciosReales);
    console.log('📊 Resultado final:', nuevosEspaciosReales);
  };

  const calcularEstadisticas = () => {
    const total = estacionamientos.length;
    const espaciosTotales = estacionamientos.reduce((sum, e) => sum + e.espacios_total, 0);
    
    // Spaces detected by YOLO (before deducting reservations)
    const espaciosYOLOTotal = Object.values(espaciosDisponiblesPorEstacionamiento)
      .reduce((sum, espacios) => sum + espacios, 0);
    
    // Total active reservations
    const totalReservasActivas = Object.values(reservasActivasPorEstacionamiento)
      .reduce((sum, reservas) => sum + reservas, 0);
    
    // Actually available spaces for new reservations (YOLO - Reservations)
    const disponiblesReales = Object.values(espaciosRealesDisponibles)
      .reduce((sum, espacios) => sum + espacios, 0);
    
    // Physically occupied spaces
    const ocupadosFisicos = Math.max(0, Math.min(espaciosTotales - espaciosYOLOTotal, espaciosTotales));

    return {
      total,
      espaciosTotales,
      espaciosYOLO: espaciosYOLOTotal,
      reservasActivas: totalReservasActivas,
      disponiblesReales,
      ocupadosFisicos
    };
  };

  const refreshData = async () => {
    console.log('\n🔄 === REFRESCANDO DATOS ===');
    setLoading(true);
    setError(null);
    setDetectionError(null);
    
    // Clear all maps
    setEspaciosDisponiblesPorEstacionamiento({});
    setReservasActivasPorEstacionamiento({});
    setEspaciosRealesDisponibles({});
    
    await initializeData();
  };

  const refreshDetection = async () => {
    if (!estacionamientos.length) return;
    
    console.log('\n🔄 === ACTUALIZANDO DETECCIÓN ===');
    try {
      // 1. Update YOLO
      await detectarEspaciosParaTodos(estacionamientos);
      // 2. Reload reservations
      await cargarReservasActivas(estacionamientos);
      // 3. Recalculate
      calcularEspaciosReales();
    } catch (e) {
      setDetectionError(`Error al actualizar detección: ${e.message}`);
    }
  };

  const actualizarDeteccionIndividual = async (estacionamientoId) => {
  try {
    setIsDetectingSpaces(true);
    setDetectionError(null);
    
    console.log(`\n🔄 === ACTUALIZANDO ESTACIONAMIENTO ${estacionamientoId} ===`);
    
    // 1. Update YOLO
    const espaciosYolo = await detectarEspaciosIndividual(estacionamientoId);
    console.log('🤖 YOLO detectó:', espaciosYolo, 'espacios');
    
    // 2. Update reservations
    const reservasActivas = await obtenerReservasActivasDelEstacionamiento(estacionamientoId);
    console.log('📅 Reservas activas:', reservasActivas);
    
    // 3. Calculate real spaces
    const espaciosReales = Math.max(0, Math.min(espaciosYolo - reservasActivas, espaciosYolo));
    console.log('✨ Espacios reales calculados:', espaciosReales);
    
    // 4. Actualizar en base de datos PRIMERO
    const bdActualizada = await actualizarEspaciosEnBD(estacionamientoId, espaciosReales);
    
    if (!bdActualizada) {
      throw new Error('No se pudo actualizar la base de datos');
    }
    
    // 5. Solo actualizar el estado si la BD se actualizó correctamente
    setEspaciosDisponiblesPorEstacionamiento(prev => ({
      ...prev,
      [estacionamientoId]: espaciosYolo
    }));
    
    setReservasActivasPorEstacionamiento(prev => ({
      ...prev,
      [estacionamientoId]: reservasActivas
    }));
    
    setEspaciosRealesDisponibles(prev => ({
      ...prev,
      [estacionamientoId]: espaciosReales
    }));
    
    // 6. Actualizar el estacionamiento en el array local
    setEstacionamientos(prev => prev.map(est => 
      est.id === parseInt(estacionamientoId) 
        ? { ...est, espacios_disponibles: espaciosReales }
        : est
    ));
    
    console.log('✅ Actualización completa finalizada');
    
    // Mostrar mensaje de éxito
    alert(`✅ Estacionamiento actualizado correctamente!\n\nEspacios disponibles: ${espaciosReales}`);
    
  } catch (error) {
    setDetectionError(`Error en actualización: ${error.message}`);
    console.error('❌ Error en actualización:', error);
    
    // Mostrar mensaje de error
    alert(`❌ Error al actualizar: ${error.message}`);
  } finally {
    setIsDetectingSpaces(false);
  }
};
  
const actualizarEspaciosEnBD = async (estacionamientoId, espaciosDisponibles) => {
  try {
    console.log(`💾 Actualizando BD - Estacionamiento ${estacionamientoId}: ${espaciosDisponibles} espacios`);
    
    // Asegurar que estacionamientoId sea número
    const id = parseInt(estacionamientoId);
    
    const payload = {
      espacios_disponibles: espaciosDisponibles
    };
    
    console.log('📤 Enviando payload:', payload);
    console.log('🎯 URL:', `/estacionamientos/${id}/espacios`);
    
    const response = await api.put(`/estacionamientos/${id}/espacios`, payload);
    
    console.log('📡 Response status:', response.status);
    console.log('📄 Response data:', response.data);
    
    if (response.status === 200) {
      console.log('✅ Base de datos actualizada correctamente');
      console.log('📊 Nuevos datos del estacionamiento:', response.data);
      return true;
    } else {
      console.error('❌ Error actualizando BD - Status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en actualizarEspaciosEnBD:', error);
    console.error('📋 Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Lanzar el error para que se capture arriba
    throw new Error(error.response?.data?.detail || error.message || 'Error desconocido al actualizar BD');
  }
};

  // Handle logout
  const handleLogout = () => {
    const { logout } = useAuth();
    logout();
    navigate('/login');
  };

  // Render components
  const renderHeader = () => (
    <div className="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h1 className="h2 fw-bold text-dark mb-1">
          Panel del Dueño - Mis Estacionamientos
        </h1>
        <p className="text-muted">
          Bienvenido, {user?.username || 'Dueño'}
        </p>
      </div>
      <div className="d-flex align-items-center gap-3">
        <button className="btn btn-light p-2" title="Notificaciones">
          🔔
        </button>
        <button 
          onClick={refreshData}
          className="btn btn-light p-2"
          title="Actualizar datos"
        >
          🔄
        </button>
        <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-semibold" 
             style={{width: '40px', height: '40px'}}>
          {(user?.username || 'D')[0].toUpperCase()}
        </div>
      </div>
    </div>
  );

  const renderDetectionStatus = () => {
    if (isDetectingSpaces) {
      return (
        <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
          <div className="spinner-border spinner-border-sm text-primary me-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span>Detectando espacios disponibles...</span>
        </div>
      );
    }

    if (detectionError) {
      return (
        <div className="alert alert-danger d-flex justify-content-between align-items-center mb-4" role="alert">
          <div className="d-flex align-items-center">
            <span className="me-2">❌</span>
            <span>Error en detección: {detectionError}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setDetectionError(null)}
          ></button>
        </div>
      );
    }

    return null;
  };

  const renderStatsCards = () => {
    const stats = calcularEstadisticas();
    
    const cards = [
      { title: 'Total de Espacios', value: stats.espaciosTotales, color: 'bg-primary', desc: 'Capacidad total' },
      { title: 'Espacios Libres', value: stats.espaciosYOLO, color: 'bg-success', desc: 'Detectados físicamente' },
      { title: 'Ya Reservados', value: stats.reservasActivas, color: 'bg-warning', desc: 'Con reservas activas' },
      { title: 'Para Reservar', value: stats.disponiblesReales, color: 'bg-info', desc: 'Disponibles ahora' }
    ];

    return (
      <div className="row g-3 mb-4">
        {cards.map((card, index) => (
          <div key={index} className="col-lg-3 col-md-6">
            <div className={`card ${card.color} text-white h-100`}>
              <div className="card-body text-center">
                <h3 className="card-title h1 mb-2 fw-bold">{card.value}</h3>
                <p className="card-text fw-semibold mb-1">{card.title}</p>
                <small className="opacity-75">{card.desc}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="d-flex flex-wrap gap-3 mb-4">
      <button className="btn btn-primary">
        ➕ Agregar Estacionamiento
      </button>
      <button
        onClick={() => navigate('/reservas_duenio')}
        className="btn btn-outline-secondary"
      >
        📅 Ver Reservas
      </button>
      <button
        onClick={refreshDetection}
        className="btn btn-outline-secondary"
      >
        🔄 Actualizar Detección
      </button>
    </div>
  );

  const renderEstacionamientoCard = (e) => {
    const espaciosYolo = espaciosDisponiblesPorEstacionamiento[e.id] || 0;
    const reservasActivas = reservasActivasPorEstacionamiento[e.id] || 0;
    const espaciosReales = espaciosRealesDisponibles[e.id] || 0;
    
    const hayDeteccionYolo = espaciosYolo > 0;
    const espaciosMostrar = hayDeteccionYolo ? espaciosReales : e.espacios_disponibles;

    // Create complete estacionamiento object similar to Dart version
    const estacionamientoCompleto = {
      id: e.id,
      nombre: e.nombre,
      direccion: e.direccion,
      precio: e.precio,
      espacios_total: e.espacios_total,
      espacios_disponibles: espaciosMostrar, // Use calculated value
      horario: e.horario,
      duenio_id: e.duenio_id,
      // Additional calculated data
      espacios_yolo: espaciosYolo,
      reservas_activas: reservasActivas,
      espacios_reales: espaciosReales,
      hay_deteccion_yolo: hayDeteccionYolo
    };

    return (
      <div key={e.id} className="col">
        <div className="card h-100 shadow-sm">
          <div className="card-body">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-start mb-3">
              <h5 className="card-title fw-bold mb-0 flex-grow-1 me-2">{e.nombre}</h5>
              {hayDeteccionYolo && (
                <span className="badge bg-success">
                  YOLO ACTIVO
                </span>
              )}
            </div>

            {/* Info */}
            <div className="mb-3">
              <div className="d-flex align-items-start mb-2">
                <span className="me-2">📍</span>
                <div>
                  <small className="text-muted">Dirección:</small>
                  <div className="text-dark">{e.direccion}</div>
                </div>
              </div>
              <div className="d-flex align-items-start mb-2">
                <span className="me-2">🕒</span>
                <div>
                  <small className="text-muted">Horario:</small>
                  <div className="text-dark">{e.horario}</div>
                </div>
              </div>
              <div className="d-flex align-items-start mb-2">
                <span className="me-2">💰</span>
                <div>
                  <small className="text-muted">Precio:</small>
                  <div className="text-dark">${e.precio?.toFixed(2)} MXN/hora</div>
                </div>
              </div>
            </div>

            {/* Availability Status */}
            <div className={`alert mb-3 ${
              espaciosMostrar > 0 
                ? 'alert-success' 
                : 'alert-danger'
            }`}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted d-block mb-1">
                    {hayDeteccionYolo ? 'Espacios disponibles para reservar' : 'Espacios según base de datos'}
                  </small>
                  <strong>
                    {espaciosMostrar} disponibles de {e.espacios_total} totales
                  </strong>
                </div>
                <span style={{fontSize: '1.5rem'}}>
                  {espaciosMostrar > 0 ? '✅' : '⚠️'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-between align-items-center">
           <button
          onClick={() => navigate(`/detail_Duenio`, { 
            state: { 
              parkingData: estacionamientoCompleto 
            } 
          })}
          className="btn btn-outline-secondary btn-sm"
        >
          👁️ Detalles
        </button>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-light btn-sm"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => actualizarDeteccionIndividual(e.id)}
                  className="btn btn-light btn-sm"
                  title="Actualizar y Guardar"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEstacionamientosList = () => (
    <div>
      <h3 className="fw-bold text-dark mb-4">Mis Estacionamientos</h3>
      {estacionamientos.length === 0 ? (
        <div className="text-center py-5">
          <div style={{fontSize: '4rem'}} className="mb-4">🅿️</div>
          <h4 className="text-dark mb-2">
            No tienes estacionamientos registrados
          </h4>
          <p className="text-muted">
            Agrega tu primer estacionamiento para comenzar
          </p>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-lg-2 row-cols-xl-3 g-4">
          {estacionamientos.map(renderEstacionamientoCard)}
        </div>
      )}
    </div>
  );

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Show loading for data
  if (loading) {
    return (
      <div className="d-flex vh-100">
        <Sidebar 
          user={user} 
          onLogout={handleLogout} 
          currentPage="inicio"
        />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted">Cargando estacionamientos...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error
  if (error) {
    return (
      <div className="d-flex vh-100">
        <Sidebar 
          user={user} 
          onLogout={handleLogout} 
          currentPage="inicio"
        />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div className="text-center">
            <div className="text-danger mb-4" style={{fontSize: '4rem'}}>❌</div>
            <p className="text-danger mb-4">Error: {error}</p>
            <button 
              onClick={refreshData}
              className="btn btn-primary"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex vh-100 bg-light">
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        currentPage="inicio"
      />
      
      <div className="flex-grow-1 overflow-auto">
        <div className="container-fluid p-4" style={{maxWidth: '1400px'}}>
          {renderHeader()}
          {renderDetectionStatus()}
          {renderStatsCards()}
          {renderActionButtons()}
          {renderEstacionamientosList()}
        </div>
      </div>
    </div>
  );
};

export default HomeDuenio;