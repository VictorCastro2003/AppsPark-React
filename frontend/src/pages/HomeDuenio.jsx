import { useEffect, useState } from "react";
import api from "../services/api";

export default function HomeDuenio() {
  const [estacionamientos, setEstacionamientos] = useState([]);

  useEffect(() => {
    const fetchEstacionamientos = async () => {
      const res = await api.get("/estacionamientos/mis-estacionamientos");
      setEstacionamientos(res.data);
    };
    fetchEstacionamientos();
  }, []);

  return (
    <div>
      <h2>Panel del Dueño</h2>
      {estacionamientos.map((e) => (
        <div key={e.id}>
          <h3>{e.nombre}</h3>
          <p>Espacios disponibles: {e.espacios_disponibles}</p>
        </div>
      ))}
    </div>
  );
}
