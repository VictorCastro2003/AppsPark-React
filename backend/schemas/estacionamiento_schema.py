from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EstacionamientoBase(BaseModel):
    nombre: str
    direccion: str
    horario: str
    precio: float
    espacios_total: int
    espacios_disponibles: int
    duenio_id: int

class EstacionamientoCreate(EstacionamientoBase):
    pass

class EstacionamientoOut(EstacionamientoBase):
    id: int
    fecha_creacion: datetime
    activo: bool

    class Config:
        orm_mode = True
