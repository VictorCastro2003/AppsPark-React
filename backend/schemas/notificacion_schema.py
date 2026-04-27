from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NotificacionOut(BaseModel):
    id: int
    usuario_id: int
    reserva_id: Optional[int] = None
    titulo: str
    mensaje: str
    leida: bool
    fecha_creacion: datetime

    class Config:
        orm_mode = True
