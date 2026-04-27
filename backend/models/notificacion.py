from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    reserva_id = Column(Integer, ForeignKey("reservas.id"), nullable=True)
    titulo = Column(String(120), nullable=False)
    mensaje = Column(String(255), nullable=False)
    leida = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.datetime.utcnow)

    usuario = relationship("Usuario")
    reserva = relationship("Reserva")
