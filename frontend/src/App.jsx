import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext"; // Importar el AuthProvider
import Landing from "./pages/LandingPage";
import Login from "./pages/Login";
import HomeDuenio from "./pages/HomeDuenio";
import HomeUsuario from "./pages/HomeUsuario";
import DetailDuenio from "./pages/DetailDuenio";
import DetailUsuario from "./pages/DetailUsuario";
import ReservaDuenio from "./pages/ReservaDuenio";
import ReservaUsuario from "./pages/ReservaUsuario";
import MisReservas from "./pages/MisReservas";
import Register from "./pages/Register"
import Profile from "./pages/profile"

function App() {
  return (
    <AuthProvider> {/* Envolver toda la aplicación con AuthProvider */}
      <Router>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<Landing />} />

          {/* Login y registro */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas principales */}
          <Route path="/home_duenio" element={<HomeDuenio />} />
          <Route path="/home_usuario" element={<HomeUsuario />} />
          <Route path="/detail_Duenio" element={<DetailDuenio />} />
          <Route path="/detail_usuario" element={<DetailUsuario />} />
          <Route path="/reservas_duenio" element={<ReservaDuenio />} />
          <Route path="/reservas_usuario" element={<ReservaUsuario />} />
          <Route path="/mis_reservas" element={<MisReservas />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;