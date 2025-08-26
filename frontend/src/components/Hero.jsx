import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="bg-light text-dark text-center p-5">
      <div className="container">
        <h1 className="display-4 fw-bold">Bienvenido a AppsPark 🚗</h1>
        <p className="lead">Encuentra y administra tus estacionamientos fácilmente.</p>
        <div className="mt-4">
          <Link to="/login" className="btn btn-dark btn-lg me-2">Iniciar Sesión</Link>
          <Link to="/register" className="btn btn-outline-dark btn-lg">Registrarse</Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;
