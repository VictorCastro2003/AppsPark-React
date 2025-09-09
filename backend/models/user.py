# app/models/user.py
from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum

class RolEnum(enum.Enum):
    admin = "admin"
    duenio = "duenio"
    usuario = "usuario"

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    rol = Column(Enum(RolEnum), nullable=False, default=RolEnum.usuario)

    estacionamientos = relationship("Estacionamiento", back_populates="duenio")  # si existe
    reservas = relationship("Reserva", back_populates="usuario")
    
