import { useState, useEffect } from 'react';

// Array de anuncios - puedes modificar o agregar más
const anuncios = [
  {
    id: 1,
    titulo: "🚗 Seguro de Auto",
    texto: "Protege tu vehículo con las mejores coberturas",
    subtexto: "Desde $299/mes",
    color: "#1a73e8",
    link: "#",
    imagen: null
  },
  {
    id: 2,
    titulo: "🔧 Servicio Automotriz",
    texto: "Mantenimiento completo para tu auto",
    subtexto: "15% descuento primera visita",
    color: "#ea4335",
    link: "#",
    imagen: null
  },
  {
    id: 3,
    titulo: "⛽ Gasolinera Premium",
    texto: "Combustible de calidad cerca de ti",
    subtexto: "Acumula puntos con cada carga",
    color: "#34a853",
    link: "#",
    imagen: null
  },
  {
    id: 4,
    titulo: "🧼 Lavado Express",
    texto: "Tu auto brillante en minutos",
    subtexto: "Desde $89 lavado exterior",
    color: "#9c27b0",
    link: "#",
    imagen: null
  },
  {
    id: 5,
    titulo: "🛞 Llantas y Rines",
    texto: "Las mejores marcas al mejor precio",
    subtexto: "Meses sin intereses disponibles",
    color: "#ff9800",
    link: "#",
    imagen: null
  }
];

export default function PublicidadBanner() {
  const [anuncioActual, setAnuncioActual] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Rotación automática cada 5 segundos
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setAnuncioActual((prev) => (prev + 1) % anuncios.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleClose = () => {
    setIsVisible(false);
    // Volver a mostrar después de 30 segundos
    setTimeout(() => setIsVisible(true), 30000);
  };

  const handlePrev = () => {
    setAnuncioActual((prev) => (prev - 1 + anuncios.length) % anuncios.length);
  };

  const handleNext = () => {
    setAnuncioActual((prev) => (prev + 1) % anuncios.length);
  };

  const handleClick = (link) => {
    if (link && link !== '#') {
      window.open(link, '_blank');
    }
  };

  if (!isVisible) return null;

  const anuncio = anuncios[anuncioActual];

  return (
    <div 
      className="border-top shadow-sm"
      style={{ 
        background: `linear-gradient(135deg, ${anuncio.color}15 0%, ${anuncio.color}05 100%)`,
        borderTop: `3px solid ${anuncio.color}`,
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container-fluid py-2 px-3">
        <div className="d-flex align-items-center justify-content-between">
          
          {/* Indicador de publicidad */}
          <div className="d-flex align-items-center">
            <span 
              className="badge me-2"
              style={{ 
                backgroundColor: anuncio.color,
                fontSize: '10px',
                opacity: 0.8
              }}
            >
              PUBLICIDAD
            </span>
          </div>

          {/* Contenido del anuncio */}
          <div 
            className="flex-grow-1 mx-3 d-flex align-items-center justify-content-center"
            style={{ cursor: anuncio.link !== '#' ? 'pointer' : 'default' }}
            onClick={() => handleClick(anuncio.link)}
          >
            {/* Navegación izquierda */}
            <button 
              className="btn btn-sm btn-link text-muted p-0 me-3"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              title="Anterior"
            >
              ‹
            </button>

            {/* Contenido */}
            <div className="text-center" style={{ minWidth: '300px' }}>
              <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                <span 
                  className="fw-bold"
                  style={{ color: anuncio.color }}
                >
                  {anuncio.titulo}
                </span>
                <span className="text-muted d-none d-md-inline">|</span>
                <span className="text-dark d-none d-md-inline">
                  {anuncio.texto}
                </span>
                <span 
                  className="badge rounded-pill"
                  style={{ 
                    backgroundColor: `${anuncio.color}20`,
                    color: anuncio.color,
                    fontSize: '11px'
                  }}
                >
                  {anuncio.subtexto}
                </span>
              </div>
            </div>

            {/* Navegación derecha */}
            <button 
              className="btn btn-sm btn-link text-muted p-0 ms-3"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              title="Siguiente"
            >
              ›
            </button>
          </div>

          {/* Indicadores de posición */}
          <div className="d-flex align-items-center gap-1 me-2">
            {anuncios.map((_, index) => (
              <span
                key={index}
                className="rounded-circle"
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: index === anuncioActual ? anuncio.color : '#ddd',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s'
                }}
                onClick={() => setAnuncioActual(index)}
              />
            ))}
          </div>

          {/* Botón cerrar */}
          <button 
            className="btn btn-sm btn-link text-muted p-0"
            onClick={handleClose}
            title="Cerrar publicidad (volverá en 30s)"
            style={{ fontSize: '18px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}