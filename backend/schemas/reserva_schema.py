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
    salida_token: Optional[str] = None
    salida_usada: Optional[bool] = None
    hora_salida: Optional[datetime] = None
    minutos_exceso: Optional[int] = None
    costo_extra: Optional[float] = None

    class Config:
        orm_mode = True

class ReservaOutWithUsuario(ReservaOut):
    usuario_nombre: Optional[str] = None
    cajon_numero: Optional[str] = None

class ReservaOutWithEstacionamiento(ReservaOut):
    estacionamiento_nombre: Optional[str] = None
    estacionamiento_precio: Optional[float] = None
    estacionamiento_direccion: Optional[str] = None

class CambiarEstadoReserva(BaseModel):
    estado: str  # 'aceptada' o 'rechazada'
