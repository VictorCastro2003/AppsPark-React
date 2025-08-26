import { useEffect, useState } from "react";
import api from "../services/api";

export default function HomeUsuario() {
  const [estacionamientos, setEstacionamientos] = useState([]);

  useEffect(() => {
    const fetchEstacionamientos = async () => {
      const res = await api.get("/estacionamientos/");
      setEstacionamientos(res.data);
    };
    fetchEstacionamientos();
  }, []);

  return (
    <div>
      <h2>Estacionamientos Disponibles</h2>
      {estacionamientos.map((e) => (
        <div key={e.id}>
          <h3>{e.nombre}</h3>
          <p>{e.ubicacion}</p>
          <p>Espacios disponibles: {e.espacios_disponibles}</p>
        </div>
      ))}
    </div>
  );
}
