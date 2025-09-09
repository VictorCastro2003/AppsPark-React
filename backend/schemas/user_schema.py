# app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr
from enum import Enum
from typing import Optional  


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

class UsuarioOut(UsuarioBase):  
    id: int

    class Config:
        from_attributes = True

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    rol: Optional[RolEnum] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None

    class Config:
        from_attributes = True