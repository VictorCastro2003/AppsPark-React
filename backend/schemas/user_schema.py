# app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr
from enum import Enum

class RolEnum(str, Enum):
    admin = "admin"
    duenio = "duenio"
    usuario = "usuario"

class UsuarioBase(BaseModel):
    nombre: str
    email: EmailStr
    rol: RolEnum

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioOut(UsuarioBase):  # <-- este nombre debe coincidir con el usado en el router
    id: int

    class Config:
        orm_mode = True
