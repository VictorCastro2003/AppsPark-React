from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Estacionamiento(Base):
    __tablename__ = "estacionamientos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    direccion = Column(Text, nullable=False)
    horario = Column(String(100), nullable=False)
    precio = Column(Float, nullable=False)
    espacios_total = Column(Integer, nullable=False)
    espacios_disponibles = Column(Integer, nullable=False)
    duenio_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.datetime.utcnow)
    activo = Column(Boolean, default=True)

    # Relaciones existentes
    duenio = relationship("Usuario", back_populates="estacionamientos")
    cajones = relationship("Cajon", back_populates="estacionamiento")
    
    # AGREGAR ESTA RELACIÓN QUE FALTA:
    reservas = relationship("Reserva", back_populates="estacionamiento")