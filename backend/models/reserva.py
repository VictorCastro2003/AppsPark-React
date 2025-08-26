from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Time
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    cajon_id = Column(Integer, ForeignKey("cajones.id"), nullable=True)  # Ahora completamente opcional
    estacionamiento_id = Column(Integer, ForeignKey("estacionamientos.id"))  
    fecha_reserva = Column(DateTime, default=datetime.datetime.utcnow)
    estado = Column(String(20), default="pendiente")  # pendiente, aceptada, rechazada
    hora_inicio = Column(Time, nullable=True)
    hora_fin = Column(Time, nullable=True)
    placa_vehiculo = Column(String(20), nullable=True)

    usuario = relationship("Usuario", back_populates="reservas")
    cajon = relationship("Cajon", back_populates="reservas")
    estacionamiento = relationship("Estacionamiento", back_populates="reservas")