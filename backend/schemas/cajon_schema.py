from pydantic import BaseModel
from typing import Any

class CajonBase(BaseModel):
    numero_cajon: str
    status: str

class CajonCreate(CajonBase):
    coordenadas: Any  # Recibimos coordenadas en formato JSON

class CajonOut(CajonBase):
    id: int
    coordenadas: Any
    estacionamiento_id: int

    class Config:
        orm_mode = True
