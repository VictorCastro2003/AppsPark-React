import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Hero from "./components/Hero";   // 👈 importa tu componente
import Login from "./pages/Login";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Hero />} />

        {/* Ejemplo: login y registro */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<h2>Pantalla de Registro</h2>} />
      </Routes>
    </Router>
  );
}

export default App;
