/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';


const ParkingOwnerDetail = ({ onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const parkingData = location.state?.parkingData || {};
  
  // Estados principales
  const [futureData, setFutureData] = useState({ loading: true, data: null, error: null });
  const [imageWithDetections, setImageWithDetections] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);
  
  // Estados para video
  const [hasVideo, setHasVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [viewMode, setViewMode] = useState('image');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDetectionResult, setVideoDetectionResult] = useState(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoFps, setVideoFps] = useState(0);
  const [videoDebugInfo, setVideoDebugInfo] = useState({ width: 0, height: 0, time: 0 });
  
  // Referencias para video
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const isSendingRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const checkVideoExists = async () => {
      try {
        const response = await fetch(`http://localhost:8000/check-video/${parkingData.id}`);
        if (response.ok) {
          const data = await response.json();
          setHasVideo(data.exists);
          if (data.exists) {
            setVideoUrl(`http://localhost:8000/video/${parkingData.id}`);
            console.log(`🎥 Video disponible en: /video/${parkingData.id}`);
          }
        }
      } catch (error) {
        console.log('Error verificando video:', error);
      }
    };
    if (parkingData.id) checkVideoExists();
  }, [parkingData.id]);

  useEffect(() => {
    if (!parkingData.id) {
      setFutureData({ loading: false, data: null, error: 'No se recibieron datos del estacionamiento' });
      return;
    }
    loadData();
  }, [parkingData]);


  useEffect(() => {
    return () => stopVideoDetection();
  }, []);

  const loadData = async () => {
    try {
      setFutureData({ loading: true, data: null, error: null });
      const results = await Promise.all([fetchImageAndDetections(), loadActiveReservations()]);
      const detections = results[0];
      const activeReservations = results[1];
      const statistics = calculateStatistics(detections, activeReservations);
      setFutureData({ loading: false, data: { detections, activeReservations, statistics, success: true }, error: null });
    } catch (error) {
      console.error('Error loading data:', error);
      setFutureData({ loading: false, data: null, error: `Error al cargar datos: ${error.message}` });
    }
  };

  const fetchImageAndDetections = async () => {
    setIsLoadingImage(true);
    setImageError(null);
    setImageWithDetections(null);
    let detections = [];
    try {
      const response = await fetch('http://localhost:8000/detect/estacionamiento/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estacionamiento_id: parkingData.id }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.image_annotated) setImageWithDetections(data.image_annotated);
        else setImageError('No se recibió imagen anotada del servidor.');
        if (data.zones && Array.isArray(data.zones)) detections = data.zones;
      } else {
        setImageError(`Error del servidor: ${response.status}`);
      }
    } catch (error) {
      setImageError(`Error de conexión: ${error.message}`);
    } finally {
      setIsLoadingImage(false);
    }
    return detections;
  };

  const loadActiveReservations = async () => {
    try {
      const response = await api.get(`/reservas/activas/${parkingData.id}`);
      if (response.status === 200) return response.data.reservas_activas || 0;
      return 0;
    } catch (error) {
      return 0;
    }
  };


  const calculateStatistics = (detections, activeReservations) => {
    const totalSpaces = parkingData.espacios_total || 0;
    let availableSpacesBackend = parkingData.espacios_disponibles || 0;
    if (parkingData.hay_deteccion_yolo && parkingData.espacios_reales !== undefined) {
      availableSpacesBackend = parkingData.espacios_reales;
    }
    const spacesDetectedByYOLO = availableSpacesBackend;
    const physicallyOccupied = totalSpaces - spacesDetectedByYOLO;
    return {
      total: totalSpaces,
      libres: Math.max(0, spacesDetectedByYOLO - activeReservations),
      reservados: activeReservations,
      ocupados_physical: Math.max(0, physicallyOccupied),
    };
  };

  const connectWebSocket = useCallback(() => {
    const wsUrl = `ws://localhost:8000/ws/detect/stream/${parkingData.id}`;
    console.log('🔌 Conectando WebSocket:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket conectado');
      setIsProcessingVideo(true);
      wsRef.current.send(JSON.stringify({ type: 'config', jpeg_quality: 70, display_width: 960 }));
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'detection_result') {
        setVideoDetectionResult(data);
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastTimeRef.current >= 1000) {
          setVideoFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }
    };
    
    wsRef.current.onerror = () => setIsProcessingVideo(false);
    wsRef.current.onclose = () => setIsProcessingVideo(false);
  }, [parkingData.id]);

  const sendVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    
    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (video.readyState < 3 || video.paused || video.ended) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (isSendingRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    try {
      ctx.drawImage(video, 0, 0);
      isSendingRef.current = true;
      canvas.toBlob(async (blob) => {
        try {
          if (blob && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await blob.arrayBuffer();
            ws.send(arrayBuffer);
          } else if (ws.readyState === WebSocket.OPEN) {
            const frameData = canvas.toDataURL('image/jpeg', 0.7);
            ws.send(JSON.stringify({ type: 'frame', data: frameData }));
          }
        } finally {
          isSendingRef.current = false;
        }
      }, 'image/jpeg', 0.7);
      setVideoDebugInfo({ width: video.videoWidth, height: video.videoHeight, time: video.currentTime });
    } catch (error) {
      console.error('❌ Error capturando frame:', error);
      isSendingRef.current = false;
    }
  }, []);

  const startVideoDetection = useCallback(() => {
    if (!videoRef.current) {
      console.error('❌ Referencia de video no disponible');
      return;
    }
    
    console.log('🎬 Iniciando detección de video...');
    const video = videoRef.current;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    connectWebSocket();
    
    const startFrameCapture = () => {
      console.log('🚀 Iniciando captura de frames');
      intervalRef.current = setInterval(() => {
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && videoRef.current.readyState >= 3) {
          sendVideoFrame();
        }
      }, 200);
    };
    
    const onPlaying = () => {
      console.log('▶️ Video reproduciendo');
      setIsVideoPlaying(true);
      setTimeout(startFrameCapture, 300);
    };
    
    video.removeEventListener('playing', onPlaying);
    video.addEventListener('playing', onPlaying, { once: true });
    
    video.muted = true;
    video.playsInline = true;
    
    if (video.readyState < 2) video.load();
    
    video.play()
      .then(() => console.log('✅ play() exitoso'))
      .catch(err => {
        console.error('❌ Error en play():', err.name, err.message);
        stopVideoDetection();
      });
  }, [connectWebSocket, sendVideoFrame]);

  const stopVideoDetection = useCallback(() => {
    console.log('⏹️ Deteniendo detección...');
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    setIsVideoPlaying(false);
    setIsProcessingVideo(false);
    setVideoDetectionResult(null);
    setVideoFps(0);
    frameCountRef.current = 0;
  }, []);

  const toggleViewMode = (mode) => {
    if (mode === viewMode) return;
    if (viewMode === 'video') stopVideoDetection();
    setViewMode(mode);
  };

  const handleRefresh = () => {
    if (viewMode === 'video') { stopVideoDetection(); setTimeout(startVideoDetection, 500); }
    else loadData();
  };

  const handleBack = () => {
    stopVideoDetection();
    if (onBack) onBack();
    else navigate(-1);
  };

  const StatItem = ({ icon, label, value, color }) => (
    <div className="text-center flex-fill">
      <i className={`fas fa-${icon} mb-2`} style={{ color, fontSize: '1.5rem' }}></i>
      <div className="fw-bold" style={{ color, fontSize: '1.25rem' }}>{value}</div>
      <small className="text-muted">{label}</small>
    </div>
  );

  const AdvancedStat = ({ title, value, icon, color }) => (
    <div className="p-3 rounded border" style={{ backgroundColor: `${color}20`, borderColor: `${color}50` }}>
      <div className="d-flex align-items-center mb-2">
        <i className={`fas fa-${icon} me-2`} style={{ color }}></i>
        <small className="text-muted fw-medium">{title}</small>
      </div>
      <div className="fw-bold" style={{ color, fontSize: '1.125rem' }}>{value}</div>
    </div>
  );

  if (futureData.loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <div className="text-muted">Cargando información...</div>
        </div>
      </div>
    );
  }

  if (futureData.error || !futureData.data?.success) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-exclamation-triangle text-warning mb-3" style={{ fontSize: '4rem' }}></i>
        <div className="text-muted mb-3">{futureData.error || 'Error al cargar datos'}</div>
        <div className="d-flex justify-content-center gap-2">
          <button className="btn btn-primary" onClick={handleRefresh}>Reintentar</button>
          <button className="btn btn-secondary" onClick={handleBack}>Volver</button>
        </div>
      </div>
    );
  }

  const { statistics } = futureData.data;
  const currentStats = viewMode === 'video' && videoDetectionResult ? {
    total: videoDetectionResult.total, libres: videoDetectionResult.available,
    ocupados_physical: videoDetectionResult.occupied, reservados: statistics.reservados
  } : statistics;

  const freeSpaces = currentStats.libres || 0;
  const totalSpaces = currentStats.total || 0;
  const reservedSpaces = currentStats.reservados || 0;
  const occupiedPhysical = currentStats.ocupados_physical || 0;
  const occupancyPercentage = totalSpaces > 0 ? ((occupiedPhysical + reservedSpaces) / totalSpaces) * 100 : 0;
  const hourlyPrice = parkingData.precio || 15.50;

  return (
    <div className="container-fluid p-4 ap-page" style={{ backgroundColor: '#f5f7fb' }}>
      {/* VIDEO OCULTO - FUERA de cualquier subcomponente para evitar re-renders */}
      {videoUrl && (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }}
            onLoadedMetadata={(e) => console.log('✅ Video metadata:', e.target.videoWidth, 'x', e.target.videoHeight)}
            onError={() => setHasVideo(false)}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <button className="btn btn-outline-secondary me-3" onClick={handleBack}>← Volver</button>
          <div>
            <h2 className="mb-0">{parkingData.nombre || 'Estacionamiento'}</h2>
            <div className="d-flex gap-2 mt-1">
              {parkingData.hay_deteccion_yolo && <small className="badge bg-success">🤖 YOLO Activo</small>}
              {hasVideo && <small className="badge bg-info">🎥 Video Disponible</small>}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh}>🔄 Actualizar</button>
      </div>

      <div className="row g-4">
        {/* Sección de imagen/video */}
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="btn-group" role="group">
                <button className={`btn ${viewMode === 'image' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => toggleViewMode('image')}>📷 Imagen</button>
                {hasVideo && <button className={`btn ${viewMode === 'video' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => toggleViewMode('video')}>🎥 Video en Vivo</button>}
              </div>
              {viewMode === 'video' && (
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${isProcessingVideo ? 'bg-success' : 'bg-secondary'}`}>{isProcessingVideo ? '🟢 Procesando' : '⚪ Detenido'}</span>
                  <span className="badge bg-info">{videoFps} FPS</span>
                </div>
              )}
            </div>
            
            <div className="card-body p-0">
              <div className="position-relative rounded overflow-hidden" style={{ height: '350px', backgroundColor: '#1a1a1a' }}>
                {/* MODO IMAGEN */}
                {viewMode === 'image' && (
                  <>
                    {isLoadingImage ? (
                      <div className="d-flex justify-content-center align-items-center h-100">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="ms-3 text-white">Detectando espacios...</div>
                      </div>
                    ) : imageError ? (
                      <div className="d-flex flex-column justify-content-center align-items-center h-100 p-3">
                        <i className="fas fa-exclamation-triangle text-danger mb-2" style={{ fontSize: '2.5rem' }}></i>
                        <div className="text-center text-danger mb-3"><strong>Error:</strong> {imageError}</div>
                        <button className="btn btn-primary btn-sm" onClick={handleRefresh}>Reintentar</button>
                      </div>
                    ) : imageWithDetections ? (
                      <div className="h-100 w-100" style={{ cursor: 'pointer' }} onClick={() => setShowFullImage(true)}>
                        <img src={imageWithDetections} alt="Detección" className="w-100 h-100" style={{ objectFit: 'contain' }} />
                      </div>
                    ) : (
                      <div className="d-flex flex-column justify-content-center align-items-center h-100 text-white">
                        <i className="fas fa-image mb-2" style={{ fontSize: '3rem' }}></i>
                        <div>Imagen no disponible</div>
                      </div>
                    )}
                  </>
                )}
                
                {/* MODO VIDEO */}
                {viewMode === 'video' && (
                  <div className="h-100 d-flex position-relative">
                    {videoDetectionResult?.image ? (
                      <img src={videoDetectionResult.image} alt="Detección en vivo" className="w-100 h-100" style={{ objectFit: 'contain' }} />
                    ) : (
                      <div className="d-flex flex-column justify-content-center align-items-center w-100 text-white">
                        {!isVideoPlaying ? (
                          <>
                            <i className="fas fa-play-circle mb-3" style={{ fontSize: '4rem', color: '#4CAF50' }}></i>
                            <h5>Video de Estacionamiento</h5>
                            <p className="text-muted">Analiza el video en tiempo real con YOLO</p>
                            {videoUrl ? (
                              <button className="btn btn-success btn-lg" onClick={startVideoDetection}>▶️ Iniciar Detección</button>
                            ) : (
                              <div className="text-danger">⚠️ Video no disponible</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="spinner-border text-success mb-3" role="status"></div>
                            <div>Procesando video...</div>
                            <small className="text-muted mt-2">{isProcessingVideo ? '🟢 Conectado' : '⚪ Conectando...'}</small>
                          </>
                        )}
                      </div>
                    )}
                    
                    {isVideoPlaying && (
                      <>
                        <button className="btn btn-danger position-absolute" style={{ top: '10px', right: '10px', zIndex: 10 }} onClick={stopVideoDetection}>⏹️ Detener</button>
                        <div className="position-absolute text-white small" style={{ top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '5px', zIndex: 10 }}>
                          <div>📹 {videoDebugInfo.width}x{videoDebugInfo.height}</div>
                          <div>🔌 WS: {isProcessingVideo ? '🟢' : '🔴'}</div>
                          <div>⏱️ {videoDebugInfo.time.toFixed(2)}s</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                <div className="position-absolute bottom-0 start-0 m-2 px-3 py-1 rounded text-white fw-bold" style={{ backgroundColor: freeSpaces > 0 ? 'rgba(40, 167, 69, 0.9)' : 'rgba(220, 53, 69, 0.9)', zIndex: 10 }}>
                  {freeSpaces > 0 ? `✅ Libres: ${freeSpaces}/${totalSpaces}` : '⚠️ Completo'}
                </div>
                <div className="position-absolute top-0 start-0 m-2 px-2 py-1 rounded" style={{ backgroundColor: viewMode === 'video' ? 'rgba(220, 53, 69, 0.9)' : 'rgba(40, 167, 69, 0.9)', zIndex: 10 }}>
                  <small className="text-white fw-bold">{viewMode === 'video' ? '🔴 EN VIVO' : '📷 IMAGEN'}</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info y disponibilidad */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">ℹ️ Información General</h5>
              <div className="mb-2">📍 {parkingData.direccion || 'No disponible'}</div>
              <div className="mb-2 text-success fw-medium">💰 ${hourlyPrice.toFixed(2)} MXN/hora</div>
              <div>🕒 {parkingData.horario || 'No disponible'}</div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">📊 Estado Actual</h5>
              <div className={`p-3 rounded mb-3 ${freeSpaces > 0 ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                <div className={`fw-bold ${freeSpaces > 0 ? 'text-success' : 'text-danger'}`}>
                  {freeSpaces > 0 ? `✅ ${freeSpaces} espacios disponibles` : '❌ COMPLETO'}
                </div>
              </div>
              <div className="d-flex justify-content-between">
                <StatItem icon="car" label="Total" value={totalSpaces} color="#007bff" />
                <StatItem icon="check-circle" label="Libres" value={freeSpaces} color="#28a745" />
                <StatItem icon="mobile-alt" label="Reservados" value={reservedSpaces} color="#fd7e14" />
                <StatItem icon="times-circle" label="Ocupados" value={occupiedPhysical} color="#dc3545" />
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">📈 Estadísticas</h5>
              <div className="row g-3">
                <div className="col-md-3">
                  <AdvancedStat title="Ocupación" value={`${occupancyPercentage.toFixed(1)}%`} icon="chart-line" color={occupancyPercentage > 80 ? '#dc3545' : occupancyPercentage > 50 ? '#fd7e14' : '#28a745'} />
                </div>
                <div className="col-md-3">
                  <AdvancedStat title="Reservas" value={reservedSpaces} icon="calendar-check" color="#007bff" />
                </div>
                <div className="col-md-3">
                  <AdvancedStat title="Ingresos/hora" value={`$${((occupiedPhysical + reservedSpaces) * hourlyPrice).toFixed(2)}`} icon="coins" color="#28a745" />
                </div>
                <div className="col-md-3">
                  <AdvancedStat title="Modo" value={viewMode === 'video' ? 'Video' : 'Imagen'} icon="eye" color={viewMode === 'video' ? '#dc3545' : '#28a745'} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullImage && imageWithDetections && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }} onClick={() => setShowFullImage(false)}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="position-relative">
              <img src={imageWithDetections} alt="Detección" className="w-100" style={{ maxHeight: '90vh', objectFit: 'contain' }} />
              <button className="btn btn-dark position-absolute top-0 end-0 m-3" onClick={() => setShowFullImage(false)}>✕</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ap-page .card {
          border-radius: 14px;
          border: 1px solid #e9ecef;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .ap-page .card-header {
          background: linear-gradient(135deg, #eef2ff, #ffffff);
          border-bottom: 1px solid #e9ecef;
        }
        .ap-page .btn-primary {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          border: none;
        }
      `}</style>
    </div>
  );
};

export default ParkingOwnerDetail;
