// src/pages/LandingPage.jsx
import Hero from "../components/Hero";
import image from "../images/logofinal.png";

function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <section className="py-5 bg-white text-dark">
        <div className="container text-center">
          <h2 className="fw-bold mb-4">¿Por qué elegir AppsPark?</h2>
          <div className="row">
            <div className="col-md-4 mb-4">
              <div className="feature-card p-4 rounded shadow-sm">
                <div className="feature-icon mb-3" style={{ color: '#3a7bd5', fontSize: '2.5rem' }}>
                  <i className="fas fa-map-marker-alt"></i>
                </div>
                <h5 className="fw-bold">📍 Encuentra rápido</h5>
                <p>Ubica el estacionamiento más cercano en segundos.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="feature-card p-4 rounded shadow-sm">
                <div className="feature-icon mb-3" style={{ color: '#3a7bd5', fontSize: '2.5rem' }}>
                  <i className="fas fa-chart-pie"></i>
                </div>
                <h5 className="fw-bold">📊 Administra</h5>
                <p>Dueños y usuarios gestionan espacios fácilmente.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="feature-card p-4 rounded shadow-sm">
                <div className="feature-icon mb-3" style={{ color: '#3a7bd5', fontSize: '2.5rem' }}>
                  <i className="fas fa-lock"></i>
                </div>
                <h5 className="fw-bold">🔒 Seguro</h5>
                <p>Accede con autenticación y reserva en tiempo real.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-5" style={{ backgroundColor: '#f0f8ff' }}>
        <div className="container text-center">
          <h2 className="fw-bold mb-5" style={{ color: '#3a7bd5' }}>¿Cómo funciona AppsPark?</h2>
          <div className="row align-items-center">
            <div className="col-md-4 mb-4">
              <div className="step-card p-4 rounded shadow-sm bg-white">
                <div className="step-icon mb-3" style={{ fontSize: "2.5rem", color: "#3a7bd5" }}>
                  <i className="fas fa-search-location"></i>
                </div>
                <h5 className="fw-bold">1. Busca</h5>
                <p>Encuentra los estacionamientos más cercanos en segundos.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="step-card p-4 rounded shadow-sm bg-white">
                <div className="step-icon mb-3" style={{ fontSize: "2.5rem", color: "#3a7bd5" }}>
                  <i className="fas fa-car"></i>
                </div>
                <h5 className="fw-bold">2. Reserva</h5>
                <p>Selecciona tu lugar disponible y confírmalo al instante.</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="step-card p-4 rounded shadow-sm bg-white">
                <div className="step-icon mb-3" style={{ fontSize: "2.5rem", color: "#3a7bd5" }}>
                  <i className="fas fa-check-circle"></i>
                </div>
                <h5 className="fw-bold">3. Disfruta</h5>
                <p>Accede fácil y estaciona con seguridad y confianza.</p>
              </div>
            </div>
          </div>

        
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-white text-center py-4">
        <div className="container">
          <div className="mb-3">
            <img src={image} alt="AppsPark Logo" height="40" className="mb-2" />
            <p className="mb-2">Encuentra y administra tus estacionamientos fácilmente</p>
          </div>
          <div className="mb-3">
            <a href="#" className="text-white me-3"><i className="fab fa-facebook-f"></i></a>
            <a href="#" className="text-white me-3"><i className="fab fa-twitter"></i></a>
            <a href="#" className="text-white me-3"><i className="fab fa-instagram"></i></a>
            <a href="#" className="text-white"><i className="fab fa-linkedin-in"></i></a>
          </div>
          <p className="mb-0">&copy; {new Date().getFullYear()} AppsPark. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
