from pydantic import BaseModel
from datetime import datetime, time
from typing import Optional

class ReservaBase(BaseModel):
    usuario_id: int
    cajon_id: Optional[int] = None
    estacionamiento_id: int
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    placa_vehiculo: Optional[str] = None

class ReservaCreate(ReservaBase):
    pass

class ReservaOut(ReservaBase):
    id: int
    fecha_reserva: datetime
    estado: str

    class Config:
        orm_mode = True

class CambiarEstadoReserva(BaseModel):
    estado: str  # 'aceptada' o 'rechazada'